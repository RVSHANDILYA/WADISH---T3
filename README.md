# CarePath

CarePath is a guided, accessible pathway-intelligence website for WA Health and Care Hackathon 2026 Challenge 2B. It links synthetic emergency and inpatient records at person-year level to reveal how age, repeat ED presentation and inpatient burden intersect.

## Product journey

1. A four-step welcome guide explains the product in plain language.
2. The overview reveals resource concentration and distinguishes acute complexity from recurrent burden.
3. The cohort explorer turns four analytical segments into understandable pathway-review prompts.
4. Scenario Lab exposes every assumption behind an illustrative capacity opportunity.
5. The Trust Centre documents definitions, limitations and safe-use boundaries.

## Technology

- React and TypeScript for the website
- Vite for local development and production builds
- Python and pandas for governed local preprocessing
- Native SVG and CSS visualisations for fast, accessible interaction

No LLM is required. The core evidence and calculations remain deterministic.

## Data governance

The supplied EDDC and HMDC files are governed by the hackathon participation agreement. Do not commit, publish, redistribute or create public derivatives without written Data Custodian approval. Raw files and the generated analytical summary are ignored by Git.

Expected local paths:

```text
data/raw/eddc.csv
data/raw/hmdc.csv
```

## First-time setup

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
npm install
npm run prepare:data
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Verification

```bash
pytest -q
npm run build
```

## Definitions

- Older person: recorded five-year age band begins at 65 or above.
- Frequent presenter: four or more ED presentations in 2022.
- High burden: top decile of linked same-year inpatient bed-days.
- Admission: selected EDDC departure statuses documented in `src/analysis.py` and the official EDDC dictionary.

The synthetic event timestamps do not support defensible one-to-one matching between each ED presentation and inpatient episode. CarePath therefore uses person-year aggregates and does not claim that a specific ED event caused a particular inpatient episode.
