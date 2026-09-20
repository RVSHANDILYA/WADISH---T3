from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.analysis import (DEFAULT_SCENARIO, GROUP_NAMES, exploration_cells, load_and_analyse,
                          rank_interventions, simulate_scenario, top_burden_share)


ED_PATH = ROOT / "data" / "raw" / "eddc.csv"
HM_PATH = ROOT / "data" / "raw" / "hmdc.csv"
OUTPUT = ROOT / "public" / "data" / "summary.json"

COHORT_CONTENT = {
    "Occasional / lower burden": {
        "id": "occasional",
        "label": "Monitor",
        "description": "Fewer than four ED visits and fewer hospital days over the year.",
        "color": "#8AA4B0",
        "pathwayPrompts": ["Standard ED pathway", "Monitor for escalation", "Routine discharge information"],
    },
    "Acute complex": {
        "id": "acute",
        "label": "Prepare early",
        "description": "Fewer than four ED visits, but among the highest 10% for hospital days over the year.",
        "color": "#F59E0B",
        "pathwayPrompts": ["Early multidisciplinary assessment", "Discharge-readiness planning", "Rehabilitation or hospital-at-home eligibility"],
    },
    "Frequent / lower burden": {
        "id": "frequent",
        "label": "Connect care",
        "description": "Four or more ED visits, with fewer hospital days over the year. Stable describes this visit pattern, not a clinical assessment.",
        "color": "#38BDF8",
        "pathwayPrompts": ["Primary-care access review", "Rapid outpatient follow-up", "Potentially avoidable presentation review"],
    },
    "High-burden recurrent": {
        "id": "recurrent",
        "label": "Coordinate",
        "description": "Four or more ED visits and among the highest 10% for hospital days over the year.",
        "color": "#0F766E",
        "pathwayPrompts": ["Comprehensive geriatric assessment", "Coordinated discharge", "Medication review", "Community rapid response"],
    },
}


def percent(value: object) -> float:
    return round(float(value), 6)


def number(value: object) -> float:
    return round(float(value), 2)


def band_rows(frame, key: str):
    return [
        {
            "label": str(row[key]),
            "patients": int(row["patients"]),
            "patientShare": percent(row["patient_share"]),
            "admissionShare": percent(row["patients_with_admission"]),
            "admissionRatePerPresentation": number(row["admissions_per_100_presentations"]),
            "inpatientBedDays": number(row["inpatient_bed_days"]),
        }
        for _, row in frame.iterrows()
    ]


def main() -> None:
    if not ED_PATH.exists() or not HM_PATH.exists():
        raise SystemExit(
            "Missing authorised data. Put EDDC at data/raw/eddc.csv and HMDC at data/raw/hmdc.csv."
        )
    bundle = load_and_analyse(ED_PATH, HM_PATH)
    cohorts = []
    for _, row in bundle.cohort.iterrows():
        name = str(row["cohort"])
        people = bundle.patient.loc[bundle.patient["cohort"].eq(name)]
        content = COHORT_CONTENT[name]
        cohorts.append(
            {
                **content,
                "name": GROUP_NAMES[name],
                "patients": int(row["patients"]),
                "patientShare": percent(row["patient_share"]),
                "edPresentations": int(row["ed_presentations"]),
                "edAdmissions": int(row["ed_admissions"]),
                "admissionShare": percent(row["patients_with_admission"]),
                "inpatientBedDays": number(row["inpatient_bed_days"]),
                "bedDayShare": percent(row["bed_day_share"]),
                "medianBedDays": number(row["median_bed_days"]),
                "medianAgeBand": int(people["age_band"].median()),
                "medianPresentations": number(people["ed_presentations"].median()),
                "potentiallyAvoidable": int(row["potentially_avoidable"]),
                "avoidable_share": percent(row["avoidable_share"]),
                "recommended_interventions": rank_interventions(row),
                "default_simulation": simulate_scenario(row, **DEFAULT_SCENARIO),
            }
        )

    # Keep the plain-language group order consistent across tabs, tables and charts.
    group_order = [content["id"] for content in COHORT_CONTENT.values()]
    cohorts.sort(key=lambda group: group_order.index(group["id"]))
    curve = bundle.burden_curve
    stride = max(1, len(curve) // 180)
    sampled = curve.iloc[::stride]
    if sampled.index[-1] != curve.index[-1]:
        sampled = __import__("pandas").concat([sampled, curve.tail(1)])

    payload = {
        "schemaVersion": 3,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "population": "Adults aged 65+ with at least one 2022 ED presentation",
        "metrics": {
            "patients": len(bundle.patient),
            "edPresentations": int(bundle.patient["ed_presentations"].sum()),
            "edAdmissions": int(bundle.patient["ed_admissions"].sum()),
            "inpatientBedDays": number(bundle.patient["inpatient_bed_days"].sum()),
            "topTenBedDayShare": percent(top_burden_share(bundle.patient)),
            "highBurdenThreshold": number(bundle.burden_threshold),
        },
        "cohorts": cohorts,
        # Totals plus exact within-cell person-year median/mean/rates; never
        # derive a median from summed or site-wide summary figures.
        "exploration": exploration_cells(bundle.patient),
        "risk_factors": bundle.risk_factors,
        "model_metrics": bundle.model_metrics,
        "cluster_validation": bundle.cluster_validation,
        "scenario_assumptions": {**DEFAULT_SCENARIO, "n_draws": 2000,
                                 "beta_concentration": 40, "days_relative_sd": 0.2},
        "frequency": band_rows(bundle.frequency, "frequency_band"),
        "age": band_rows(bundle.age, "age_group"),
        "concentration": [
            {"patientShare": percent(row["cumulative_patients"]), "bedDayShare": percent(row["cumulative_bed_days"])}
            for _, row in sampled.iterrows()
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")
    print(f"Prepared {OUTPUT.relative_to(ROOT)} for {payload['metrics']['patients']:,} patients.")


if __name__ == "__main__":
    main()
