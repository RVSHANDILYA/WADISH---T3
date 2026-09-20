from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.analysis import (AGE_LABELS, FREQUENCY_LABELS, GROUP_NAMES,
                          admission_risk_model, exploration_cells, load_and_analyse, rank_interventions,
                          simulate_scenario, top_burden_share, validate_clusters)


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
    cells = exploration_cells(bundle.patient)
    assert len(cells) == 18
    assert sum(cell["patients"] for cell in cells) == len(bundle.patient)
    assert sum(cell["edPresentations"] for cell in cells) == bundle.patient.ed_presentations.sum()
    assert sum(cell["edAdmissions"] for cell in cells) == bundle.patient.ed_admissions.sum()
    assert sum(cell["inpatientBedDays"] for cell in cells) == pytest.approx(bundle.patient.inpatient_bed_days.sum(), abs=.1)
    for cell in cells:
        rows = bundle.patient.loc[(bundle.patient.age_group == cell["ageGroup"]) & (bundle.patient.frequency_band == cell["frequencyBand"])]
        if len(rows):
            assert cell["median_bed_days_per_person"] == pytest.approx(rows.inpatient_bed_days.median())
            assert cell["mean_bed_days_per_person"] == pytest.approx(rows.inpatient_bed_days.mean())
            assert cell["ed_presentations_per_person"] == pytest.approx(rows.ed_presentations.mean())
            assert cell["admissions_per_100_presentations"] == pytest.approx(rows.ed_admissions.sum() / rows.ed_presentations.sum() * 100)
            # For non-negative stays the median may exceed the mean, but never 2x.
            assert cell["median_bed_days_per_person"] <= 2 * cell["mean_bed_days_per_person"] + 1e-9
    # These remain the original rule-based groups, not KMeans assignments.
    for _, row in bundle.patient.iterrows():
        expected = ("High-burden recurrent" if row.high_burden else "Frequent / lower burden") if row.frequent_presenter else ("Acute complex" if row.high_burden else "Occasional / lower burden")
        assert row.cohort == expected
    assert bundle.model_metrics["train_size"] + bundle.model_metrics["test_size"] == len(bundle.patient)
    assert 0 <= bundle.model_metrics["accuracy"] <= 1
    assert 0 <= bundle.model_metrics["auc"] <= 1
    assert len(bundle.risk_factors) == 5
    assert all(0 <= f["importance"] <= 1 for f in bundle.risk_factors)
    assert sum(f["importance"] for f in bundle.risk_factors) <= 1 + 1e-9
    clusters = bundle.cluster_validation["clusters"]
    assert sum(c["size"] for c in clusters) == len(bundle.patient)
    assert len({c["matched_group"] for c in clusters}) == 4
    matched = sum(c["group_counts"][c["matched_group"]] for c in clusters)
    assert bundle.cluster_validation["agreement_rate"] == pytest.approx(matched / len(bundle.patient) * 100)
    for _, group in bundle.cohort.iterrows():
        assert group.avoidable_share == pytest.approx(group.potentially_avoidable / group.ed_presentations)
        assert 0 <= group.avoidable_share <= 1
        for name, plain_name in GROUP_NAMES.items():
            if name == group.cohort:
                assert sum(c["group_counts"][plain_name] for c in clusters) == group.patients
        ranked = rank_interventions(group)
        assert len(ranked) == 2 and ranked[0]["score"] >= ranked[1]["score"]
        assert all(0 <= item["score"] <= 100 for item in ranked)


def test_risk_model_is_reproducible_and_reports_held_out_metrics():
    rng = np.random.default_rng(19)
    n = 300
    age = rng.choice([65, 75, 85], n)
    visits = rng.integers(1, 12, n)
    patient = pd.DataFrame({
        "age": age, "ed_presentations": visits,
        "age_group": pd.cut(age, [64, 74, 84, 200], labels=AGE_LABELS),
        "frequency_band": pd.cut(visits, [0, 1, 2, 3, 5, 10, np.inf], labels=FREQUENCY_LABELS),
        "any_ed_admission": rng.random(n) < (visits / 15),
    })
    factors, metrics = admission_risk_model(patient)
    assert (factors, metrics) == admission_risk_model(patient)
    assert metrics["train_size"] == 240 and metrics["test_size"] == 60
    assert metrics["auc"] > .6
    assert all("_" not in f["factor"] for f in factors)
    assert [f["importance"] for f in factors] == sorted([f["importance"] for f in factors], reverse=True)
    patient["any_ed_admission"] = True
    factors, metrics = admission_risk_model(patient)
    assert not factors and metrics["status"] == "unavailable" and metrics["auc"] is None


def test_clustering_matches_permuted_labels_without_changing_groups():
    # Four distinct patterns give perfect agreement independent of KMeans IDs.
    patients = pd.DataFrame([
        {"ed_presentations": visits, "inpatient_bed_days": days, "age": age, "cohort": group}
        for group, (visits, days, age) in zip(GROUP_NAMES, [(1, 0, 65), (1, 100, 85), (10, 0, 65), (10, 100, 85)])
        for _ in range(12)
    ])
    original = patients.copy(deep=True)
    result = validate_clusters(patients)
    pd.testing.assert_frame_equal(patients, original)
    assert result["agreement_rate"] == 100
    assert len({c["matched_group"] for c in result["clusters"]}) == 4
    assert validate_clusters(patients.iloc[:3])["status"] == "unavailable"


def test_pathway_ranking_responds_to_observed_need():
    group = {"avoidable_share": .99, "admissions_per_100_presentations": 0,
             "median_bed_days": 0, "median_presentations": 1, "median_age": 65}
    assert rank_interventions(group)[0]["name"] == "GP diversion support"
    group.update(avoidable_share=0, median_presentations=10)
    assert rank_interventions(group)[0]["name"] == "Regular home nurse visits"
    group.update(median_presentations=1, median_bed_days=14, admissions_per_100_presentations=100, median_age=90)
    assert rank_interventions(group)[0]["name"] == "Comprehensive check-up after discharge"


@pytest.mark.parametrize("eligible,uptake,days", [(0, 60, 1.5), (20, 0, 1.5), (20, 60, 0)])
def test_simulation_zero_assumptions(eligible, uptake, days):
    assert simulate_scenario({"patients": 1000, "inpatient_bed_days": 10000}, eligible, uptake, days) == {
        "p10": 0, "p50": 0, "p90": 0, "mean": 0}


def test_simulation_distribution_and_observed_cap():
    group = {"patients": 1000, "inpatient_bed_days": 10000}
    result = simulate_scenario(group, 20, 60, 1.5)
    assert result == simulate_scenario(group, 20, 60, 1.5)
    assert 0 < result["p10"] < result["p50"] < result["p90"] < 10000
    assert result["mean"] == pytest.approx(1000 * .2 * .6 * 1.5, rel=.05)
    assert simulate_scenario({**group, "inpatient_bed_days": 10}, 100, 100, 5)["p90"] <= 10
    assert simulate_scenario({**group, "patients": 0}, 20, 60, 1.5)["mean"] == 0
    with pytest.raises(ValueError):
        simulate_scenario(group, -1, 60, 1.5)
    with pytest.raises(ValueError):
        simulate_scenario(group, 20, 60, 1.5, n_draws=0)
    with pytest.raises(ValueError):
        simulate_scenario(group, 20, 60, float("nan"))


def test_exploration_cells_are_disjoint_and_include_empty_combinations():
    patients = pd.DataFrame({
        "synth_person_ID": [1, 2, 3], "age_group": ["65-74", "65-74", "85+"],
        "frequency_band": ["1", "1", "11+"], "ed_presentations": [1, 1, 12],
        "ed_admissions": [0, 1, 3], "inpatient_bed_days": [0., 4.25, 40.5],
        "potentially_avoidable_presentations": [1, 0, 2],
    })
    cells = exploration_cells(patients)
    assert len(cells) == 18
    assert cells[0] == {"ageGroup": "65-74", "frequencyBand": "1", "patients": 2,
                        "edPresentations": 2, "edAdmissions": 1,
                        "inpatientBedDays": 4.25, "potentiallyAvoidable": 1,
                        "total_bed_days": 4.25, "median_bed_days_per_person": 2.125,
                        "mean_bed_days_per_person": 2.125, "ed_presentations_per_person": 1.,
                        "admissions_per_100_presentations": 50.}
    assert cells[1]["patients"] == 0 and cells[1]["inpatientBedDays"] == 0
    assert sum(c["patients"] for c in cells) == 3
    assert sum(c["potentiallyAvoidable"] for c in cells) == 3
    assert set(cells[0]) == {"ageGroup", "frequencyBand", "patients", "edPresentations",
                            "edAdmissions", "inpatientBedDays", "potentiallyAvoidable",
                            "total_bed_days", "median_bed_days_per_person", "mean_bed_days_per_person",
                            "ed_presentations_per_person", "admissions_per_100_presentations"}
    assert cells[1]["median_bed_days_per_person"] is None
    assert cells[1]["mean_bed_days_per_person"] is None
    assert cells[1]["ed_presentations_per_person"] is None
    assert cells[1]["admissions_per_100_presentations"] is None
    assert cells[-1]["median_bed_days_per_person"] == 40.5
    assert cells[0]["median_bed_days_per_person"] != patients.inpatient_bed_days.median()
    assert cells[-1]["median_bed_days_per_person"] != patients.inpatient_bed_days.median()


def test_cell_median_is_not_mean_and_includes_zero_days():
    patients = pd.DataFrame({
        "synth_person_ID": [1, 2, 3, 4, 5],
        "age_group": ["65-74"] * 3 + ["85+"] * 2,
        "frequency_band": ["1"] * 5,
        "ed_presentations": [1] * 5,
        "ed_admissions": [0, 1, 1, 1, 1],
        "inpatient_bed_days": [0., 2., 100., 10., 20.],
        "potentially_avoidable_presentations": [0] * 5,
    })
    cells = exploration_cells(patients)
    young, older = cells[0], cells[12]
    assert young["median_bed_days_per_person"] == 2.
    assert young["mean_bed_days_per_person"] == 34.
    assert older["median_bed_days_per_person"] == 15.
    assert young["total_bed_days"] == 102.
    assert young["admissions_per_100_presentations"] == pytest.approx(200 / 3)
    assert len({c["median_bed_days_per_person"] for c in cells if c["patients"]}) == 2
