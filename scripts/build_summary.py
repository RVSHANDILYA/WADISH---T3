from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.analysis import load_and_analyse, top_burden_share


ED_PATH = ROOT / "data" / "raw" / "eddc.csv"
HM_PATH = ROOT / "data" / "raw" / "hmdc.csv"
OUTPUT = ROOT / "public" / "data" / "summary.json"

COHORT_CONTENT = {
    "Occasional / lower burden": {
        "id": "occasional",
        "label": "Monitor",
        "description": "Lower recurrence and lower same-year inpatient burden.",
        "color": "#8AA4B0",
        "pathwayPrompts": ["Standard ED pathway", "Monitor for escalation", "Routine discharge information"],
    },
    "Acute complex": {
        "id": "acute",
        "label": "Prepare early",
        "description": "Fewer ED presentations, but substantial inpatient burden when care is required.",
        "color": "#F59E0B",
        "pathwayPrompts": ["Early multidisciplinary assessment", "Discharge-readiness planning", "Rehabilitation or hospital-at-home eligibility"],
    },
    "Frequent / lower burden": {
        "id": "frequent",
        "label": "Connect care",
        "description": "Repeated ED contact without top-decile inpatient burden.",
        "color": "#38BDF8",
        "pathwayPrompts": ["Primary-care access review", "Rapid outpatient follow-up", "Potentially avoidable presentation review"],
    },
    "High-burden recurrent": {
        "id": "recurrent",
        "label": "Coordinate",
        "description": "Repeated ED contact combined with top-decile same-year inpatient burden.",
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
                "name": name,
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
            }
        )

    curve = bundle.burden_curve
    stride = max(1, len(curve) // 180)
    sampled = curve.iloc[::stride]
    if sampled.index[-1] != curve.index[-1]:
        sampled = __import__("pandas").concat([sampled, curve.tail(1)])

    payload = {
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
        "frequency": band_rows(bundle.frequency, "frequency_band"),
        "age": band_rows(bundle.age, "age_group"),
        "concentration": [
            {"patientShare": percent(row["cumulative_patients"]), "bedDayShare": percent(row["cumulative_bed_days"])}
            for _, row in sampled.iterrows()
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Prepared {OUTPUT.relative_to(ROOT)} for {payload['metrics']['patients']:,} patients.")


if __name__ == "__main__":
    main()
