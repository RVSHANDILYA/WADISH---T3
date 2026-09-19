from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from itertools import permutations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits


ADMITTED_DEPARTURE_STATUSES = {1, 3, 10, 14, 19}
AGE_BANDS = [64, 74, 84, 200]
AGE_LABELS = ["65-74", "75-84", "85+"]
FREQUENCY_BANDS = [0, 1, 2, 3, 5, 10, np.inf]
FREQUENCY_LABELS = ["1", "2", "3", "4-5", "6-10", "11+"]
GROUP_NAMES = {
    "Occasional / lower burden": "Occasional visitors",
    "Acute complex": "Rare but serious",
    "Frequent / lower burden": "Frequent but stable",
    "High-burden recurrent": "Frequent and high-need",
}
DEFAULT_SCENARIO = {"eligible_pct": 20, "uptake_pct": 60, "days_per_patient": 1.5}


@dataclass(frozen=True)
class AnalysisBundle:
    patient: pd.DataFrame
    ed: pd.DataFrame
    cohort: pd.DataFrame
    frequency: pd.DataFrame
    age: pd.DataFrame
    burden_curve: pd.DataFrame
    burden_threshold: float
    risk_factors: list[dict]
    model_metrics: dict
    cluster_validation: dict


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
    # The numeric age is a supplied five-year band's lower bound, not an exact age.
    patient["age"] = patient["age_band"]

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
    risk_factors, model_metrics = admission_risk_model(patient)
    cluster_validation = validate_clusters(patient)
    return AnalysisBundle(
        patient=patient,
        ed=ed,
        cohort=cohort,
        frequency=frequency,
        age=age,
        burden_curve=burden_curve,
        burden_threshold=burden_threshold,
        risk_factors=risk_factors,
        model_metrics=model_metrics,
        cluster_validation=cluster_validation,
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
            median_presentations=("ed_presentations", "median"),
            median_age=("age_band", "median"),
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
    result["avoidable_share"] = result["potentially_avoidable"].div(
        result["ed_presentations"].replace(0, np.nan)
    ).fillna(0)
    return result


def admission_risk_model(patient: pd.DataFrame) -> tuple[list[dict], dict]:
    """Retrospective association, not a prospective or individual risk service.

    All scaling is learned on the training partition only. Frequency and the
    outcome cover the SAME year, so performance must not imply future prediction.
    Correlated age/frequency and dummy features make individual coefficients
    conditional associations; absolute standardized weights are not causal effects.
    """
    target = patient["any_ed_admission"].astype(int)
    metrics = {"status": "unavailable", "accuracy": None, "auc": None,
               "baseline_accuracy": None, "train_size": 0, "test_size": 0,
               "reason": "Not enough patients with both outcomes for an 80/20 split."}
    if len(patient) < 10 or target.nunique() < 2 or target.value_counts().min() < 2:
        return [], metrics
    features = pd.DataFrame({"Older age (recorded age band)": patient["age"].astype(float),
                             "More ED visits this year": patient["ed_presentations"].astype(float)})
    # Fixed category definitions; first category is the reference, avoiding a
    # full set of redundant dummy columns. Standardize dummies as well as numbers.
    for band in AGE_LABELS[1:]:
        features[f"Age {band}"] = patient["age_group"].eq(band).astype(float)
    for band in FREQUENCY_LABELS[1:]:
        label = f"{band} ED visits this year" if band != "11+" else "11 or more ED visits this year"
        features[label] = patient["frequency_band"].eq(band).astype(float)
    x_train, x_test, y_train, y_test = train_test_split(
        features, target, test_size=0.2, random_state=42, stratify=target
    )
    scaler = StandardScaler()
    train = scaler.fit_transform(x_train)
    test = scaler.transform(x_test)
    model = LogisticRegression(max_iter=2000, random_state=42)
    model.fit(train, y_train)
    probabilities = model.predict_proba(test)[:, 1]
    metrics.update(status="fitted", accuracy=float(accuracy_score(y_test, model.predict(test))),
                   auc=float(roc_auc_score(y_test, probabilities)) if y_test.nunique() == 2 else None,
                   baseline_accuracy=float((y_test == y_train.mode().iloc[0]).mean()),
                   train_size=len(y_train), test_size=len(y_test), reason=None)
    weights = model.coef_[0]
    total = float(np.abs(weights).sum())
    order = np.argsort(-np.abs(weights), kind="stable")[:5]
    factors = [{"factor": str(features.columns[i]),
                "importance": float(abs(weights[i]) / total) if total else 0.0,
                "direction": "higher" if weights[i] > 0 else "lower" if weights[i] < 0 else "neutral"}
               for i in order]
    return factors, metrics


def validate_clusters(patient: pd.DataFrame) -> dict:
    """Match KMeans labels to rule groups with the best ONE-TO-ONE assignment.

    A cluster ID has no inherent meaning. Searching all 24 permutations prevents
    label numbering affecting agreement; multiple clusters cannot claim the same
    majority group. This is a descriptive check on the same data, not validation
    of clinical usefulness. Keep the rule-based assignments completely unchanged.
    """
    columns = ["ed_presentations", "inpatient_bed_days", "age"]
    values = patient[columns].astype(float)
    names = list(GROUP_NAMES)
    if len(values.drop_duplicates()) < 4:
        return {"status": "unavailable", "agreement_rate": None, "clusters": [],
                "reason": "At least four distinct patient patterns are needed."}
    scaler = StandardScaler()
    scaled = scaler.fit_transform(values)
    # Bound native worker count for reproducibility and Windows MKL memory use.
    with threadpool_limits(limits=1):
        model = KMeans(n_clusters=4, n_init=10, random_state=42).fit(scaled)
    table = pd.crosstab(pd.Series(model.labels_, index=patient.index), patient["cohort"])
    table = table.reindex(index=range(4), columns=names, fill_value=0)
    counts = table.to_numpy()
    matching = max(permutations(range(4)), key=lambda p: sum(counts[i, p[i]] for i in range(4)))
    agreement = sum(counts[i, matching[i]] for i in range(4)) / len(patient) * 100
    centers = scaler.inverse_transform(model.cluster_centers_)
    return {"status": "fitted", "agreement_rate": float(agreement), "reason": None,
            "clusters": [{"cluster": i + 1, "size": int(counts[i].sum()),
                          "matched_group": GROUP_NAMES[names[matching[i]]],
                          "center": {"ed_presentations": float(centers[i, 0]),
                                     "hospital_days": float(centers[i, 1]),
                                     "age": float(centers[i, 2])},
                          "group_counts": {GROUP_NAMES[name]: int(counts[i, j]) for j, name in enumerate(names)}}
                         for i in range(4)]}


def rank_interventions(group: dict | pd.Series) -> list[dict]:
    """Transparent planning scores (0-100), NOT learned treatment effectiveness.

    Saturate typical visits at 10/year and typical hospital days at 14/year.
    Admission is the fraction of visits with an admission disposition. Weights
    express planning priorities only; medicines and service effects aren't observed.
    """
    avoidable = float(np.clip(group["avoidable_share"], 0, 1))
    admission = float(np.clip(group["admissions_per_100_presentations"] / 100, 0, 1))
    stay = float(np.clip(group["median_bed_days"] / 14, 0, 1))
    frequency = float(np.clip(group["median_presentations"] / 10, 0, 1))
    older = float(np.clip((group["median_age"] - 65) / 25, 0, 1))
    catalogue = [
        ("GP diversion support", avoidable,
         "GP-type visit share; higher shares raise this planning score."),
        ("Comprehensive check-up after discharge", .50 * stay + .35 * admission + .15 * older,
         "50% hospital-day score + 35% admission share + 15% age score."),
        ("Regular home nurse visits", .65 * frequency + .25 * stay + .10 * admission,
         "65% repeat-visit score + 25% hospital-day score + 10% admission share."),
        ("Medication review", .40 * older + .35 * frequency + .25 * admission,
         "40% age score + 35% repeat-visit score + 25% admission share; medicines are not recorded."),
        ("Rapid community response team", .45 * admission + .35 * frequency + .20 * stay,
         "45% admission share + 35% repeat-visit score + 20% hospital-day score."),
    ]
    ranked = sorted(catalogue, key=lambda item: (-item[1], item[0]))[:2]
    return [{"name": name, "score": round(score * 100, 2), "reason": reason}
            for name, score, reason in ranked]


def simulate_scenario(group: dict | pd.Series, eligible_pct: float, uptake_pct: float,
                      days_per_patient: float, n_draws: int = 2000) -> dict:
    """Independent assumption draws, not a confidence interval or proven savings.

    Beta means equal sliders / 100, concentration=40; 0/100 are point masses.
    Days use Normal(mean, 20% of mean), clipped at zero. Each draw is capped at
    the group's recorded annual hospital days. Fixed seed prevents UI jitter;
    TypeScript uses the same distributions, concentration, cap and quantiles.
    """
    patients = float(group["patients"])
    bed_days = float(group["inpatient_bed_days"])
    inputs = [patients, bed_days, eligible_pct, uptake_pct, days_per_patient]
    if (not all(np.isfinite(inputs)) or patients < 0 or bed_days < 0
            or not 0 <= eligible_pct <= 100 or not 0 <= uptake_pct <= 100
            or days_per_patient < 0 or not isinstance(n_draws, int) or n_draws < 1):
        raise ValueError("Use finite, non-negative values, percentages 0-100 and a positive draw count.")
    rng = np.random.default_rng(42)

    def proportion(percent: float) -> np.ndarray:
        mean = percent / 100
        if mean in (0, 1):
            return np.full(n_draws, mean)
        return rng.beta(mean * 40, (1 - mean) * 40, n_draws)

    eligible = proportion(eligible_pct)
    uptake = proportion(uptake_pct)
    days = np.maximum(0, rng.normal(days_per_patient, days_per_patient * .20, n_draws))
    draws = np.minimum(bed_days, patients * eligible * uptake * days)
    p10, p50, p90 = np.quantile(draws, [.1, .5, .9])
    return {"p10": float(p10), "p50": float(p50), "p90": float(p90), "mean": float(draws.mean())}


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
