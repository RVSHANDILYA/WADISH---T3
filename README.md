# CarePath

CarePath is an explainable decision-support prototype for WA Health and Care Hackathon 2026 Challenge 2B. It links synthetic emergency and inpatient records at person-year level to identify how age, repeat ED presentation and inpatient burden intersect, then provides transparent pathway-planning scenarios.

## Demo journey

1. Reveal how inpatient bed-days are concentrated across the older-person cohort.
2. Separate acute-complex demand from recurrent high-burden demand.
3. Explore the admission gradient as presentation frequency rises.
4. Select an operational cohort and test a transparent pathway-review scenario.

## Data governance

The supplied EDDC and HMDC files are governed by the hackathon participation agreement. Do not commit, publish, redistribute or create public derivatives of those files without written Data Custodian approval. Only authorised participants should obtain the data through the official hackathon channel.

Expected local paths:

```text
data/raw/eddc.csv
data/raw/hmdc.csv
```

These paths are ignored by Git. They can alternatively be set with `CAREPATH_EDDC_PATH` and `CAREPATH_HMDC_PATH`.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

## Cohort definitions

- Older person: recorded five-year age band begins at 65 or above.
- Frequent presenter: four or more ED presentations in 2022.
- High burden: top decile of linked same-year inpatient bed-days.
- Admission: selected EDDC departure statuses defined in `src/analysis.py` and documented in the official EDDC dictionary.

## Important interpretation boundary

The synthetic event timestamps do not support defensible one-to-one matching between each ED presentation and each inpatient episode. CarePath therefore uses person-year aggregates and does not claim that a specific ED event caused a particular inpatient episode.

