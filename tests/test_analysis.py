from pathlib import Path

import pytest

from src.analysis import load_and_analyse, top_burden_share


ED_PATH = Path("data/raw/eddc.csv")
HM_PATH = Path("data/raw/hmdc.csv")


@pytest.mark.skipif(not ED_PATH.exists() or not HM_PATH.exists(), reason="authorised data not present")
def test_analysis_invariants() -> None:
    bundle = load_and_analyse(ED_PATH, HM_PATH)

    assert len(bundle.patient) > 0
    assert bundle.patient["age_band"].min() >= 65
    assert bundle.patient["inpatient_bed_days"].min() >= 0
    assert bundle.cohort["patients"].sum() == len(bundle.patient)
    assert bundle.cohort["patient_share"].sum() == pytest.approx(1.0)
    assert bundle.cohort["bed_day_share"].sum() == pytest.approx(1.0)
    assert 0 <= top_burden_share(bundle.patient) <= 1

