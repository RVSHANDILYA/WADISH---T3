from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


ADMITTED_DEPARTURE_STATUSES = {1, 3, 10, 14, 19}
AGE_BANDS = [64, 74, 84, 200]
AGE_LABELS = ["65-74", "75-84", "85+"]
FREQUENCY_BANDS = [0, 1, 2, 3, 5, 10, np.inf]
FREQUENCY_LABELS = ["1", "2", "3", "4-5", "6-10", "11+"]


@dataclass(frozen=True)
class AnalysisBundle:
    patient: pd.DataFrame
    ed: pd.DataFrame
    cohort: pd.DataFrame
    frequency: pd.DataFrame
    age: pd.DataFrame
    burden_curve: pd.DataFrame
    burden_threshold: float


def _require_columns(frame: pd.DataFrame, required: set[str], name: str) -> None:
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise ValueError(f"{name} is missing required columns: {', '.join(missing)}")


def load_and_analyse(ed_path: str | Path, hm_path: str | Path) -> AnalysisBundle:
    """Build defensible patient-level cohorts from the linked synthetic collections.

    Linkage is at person-year level. We deliberately do not imply that an individual
    HMDC episode was caused by a particular ED presentation because synthetic event
    timestamps do not support reliable episode-level matching.
    """
    ed_columns = [
        "synth_person_ID",
        "age",
        "departure_status",
        "potentially_avoidable_general_practitioner_type_attendance",
        "presentation_datetime",
    ]
    hm_columns = [
        "synth_person_ID",
        "age",
        "admission_datetime",
        "separation_datetime",
        "admission_status",
        "care_type",
    ]
    ed = pd.read_csv(ed_path, usecols=ed_columns, low_memory=False)
    hm = pd.read_csv(hm_path, usecols=hm_columns, low_memory=False)
    _require_columns(ed, set(ed_columns), "EDDC")
    _require_columns(hm, set(hm_columns), "HMDC")

    ed["presentation_datetime"] = pd.to_datetime(ed["presentation_datetime"], errors="coerce")
    hm["admission_datetime"] = pd.to_datetime(hm["admission_datetime"], errors="coerce")
    hm["separation_datetime"] = pd.to_datetime(hm["separation_datetime"], errors="coerce")

    ed = ed.loc[ed["age"].ge(65)].copy()
    hm = hm.loc[hm["age"].ge(65)].copy()
    ed["admitted_from_ed"] = ed["departure_status"].isin(ADMITTED_DEPARTURE_STATUSES)
    ed["potentially_avoidable"] = ed[
        "potentially_avoidable_general_practitioner_type_attendance"
    ].eq(1)
    ed["age_group"] = pd.cut(
        ed["age"], AGE_BANDS, labels=AGE_LABELS, include_lowest=True
    )

    hm["bed_days"] = (
        hm["separation_datetime"] - hm["admission_datetime"]
    ).dt.total_seconds().div(86_400).clip(lower=0)

    patient_ed = (
        ed.groupby("synth_person_ID", as_index=False)
        .agg(
            age_band=("age", "max"),
            ed_presentations=("synth_person_ID", "size"),
            ed_admissions=("admitted_from_ed", "sum"),
            any_ed_admission=("admitted_from_ed", "max"),
            potentially_avoidable_presentations=("potentially_avoidable", "sum"),
        )
    )
    patient_hm = (
        hm.groupby("synth_person_ID", as_index=False)
        .agg(
            inpatient_episodes=("synth_person_ID", "size"),
            inpatient_bed_days=("bed_days", "sum"),
            emergency_inpatient_episodes=(
                "admission_status",
                lambda values: values.isin([6, 7]).sum(),
            ),
        )
    )
    patient = patient_ed.merge(patient_hm, on="synth_person_ID", how="left")
    fill_columns = [
        "inpatient_episodes",
        "inpatient_bed_days",
        "emergency_inpatient_episodes",
    ]
    patient[fill_columns] = patient[fill_columns].fillna(0)
    patient["age_group"] = pd.cut(
        patient["age_band"], AGE_BANDS, labels=AGE_LABELS, include_lowest=True
    )
    patient["frequency_band"] = pd.cut(
        patient["ed_presentations"],
        FREQUENCY_BANDS,
        labels=FREQUENCY_LABELS,
        include_lowest=True,
    )

    burden_threshold = float(patient["inpatient_bed_days"].quantile(0.90))
    patient["frequent_presenter"] = patient["ed_presentations"].ge(4)
    patient["high_burden"] = patient["inpatient_bed_days"].ge(burden_threshold)
    patient["cohort"] = np.select(
        [
            ~patient["frequent_presenter"] & ~patient["high_burden"],
            ~patient["frequent_presenter"] & patient["high_burden"],
            patient["frequent_presenter"] & ~patient["high_burden"],
            patient["frequent_presenter"] & patient["high_burden"],
        ],
        [
            "Occasional / lower burden",
            "Acute complex",
            "Frequent / lower burden",
            "High-burden recurrent",
        ],
        default="Unclassified",
    )

    cohort = _summarise(patient, "cohort")
    frequency = _summarise(patient, "frequency_band")
    age = _summarise(patient, "age_group")
    burden_curve = _burden_curve(patient)
    return AnalysisBundle(
        patient=patient,
        ed=ed,
        cohort=cohort,
        frequency=frequency,
        age=age,
        burden_curve=burden_curve,
        burden_threshold=burden_threshold,
    )


def _summarise(patient: pd.DataFrame, dimension: str) -> pd.DataFrame:
    result = (
        patient.groupby(dimension, observed=True)
        .agg(
            patients=("synth_person_ID", "size"),
            ed_presentations=("ed_presentations", "sum"),
            ed_admissions=("ed_admissions", "sum"),
            patients_with_admission=("any_ed_admission", "mean"),
            inpatient_bed_days=("inpatient_bed_days", "sum"),
            median_bed_days=("inpatient_bed_days", "median"),
            potentially_avoidable=("potentially_avoidable_presentations", "sum"),
        )
        .reset_index()
    )
    result["patient_share"] = result["patients"] / result["patients"].sum()
    total_bed_days = result["inpatient_bed_days"].sum()
    result["bed_day_share"] = np.where(
        total_bed_days > 0, result["inpatient_bed_days"] / total_bed_days, 0
    )
    result["admissions_per_100_presentations"] = np.where(
        result["ed_presentations"] > 0,
        result["ed_admissions"] / result["ed_presentations"] * 100,
        0,
    )
    return result


def _burden_curve(patient: pd.DataFrame) -> pd.DataFrame:
    ordered = patient.sort_values("inpatient_bed_days").reset_index(drop=True)
    n = len(ordered)
    total = ordered["inpatient_bed_days"].sum()
    ordered["cumulative_patients"] = (np.arange(n) + 1) / n
    ordered["cumulative_bed_days"] = (
        ordered["inpatient_bed_days"].cumsum() / total if total else 0
    )
    anchors = pd.DataFrame(
        {"cumulative_patients": [0.0], "cumulative_bed_days": [0.0]}
    )
    return pd.concat(
        [anchors, ordered[["cumulative_patients", "cumulative_bed_days"]]],
        ignore_index=True,
    )


def top_burden_share(patient: pd.DataFrame, fraction: float = 0.10) -> float:
    count = max(1, int(np.ceil(len(patient) * fraction)))
    ordered = patient.nlargest(count, "inpatient_bed_days")
    total = patient["inpatient_bed_days"].sum()
    return float(ordered["inpatient_bed_days"].sum() / total) if total else 0.0

