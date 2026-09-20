# CarePath

CarePath is an accessible care-planning dashboard for WA Health and Care Hackathon 2026 Challenge 2B. It links synthetic emergency and hospital records over a year to help teams understand group patterns in age, repeat visits and hospital time.

## Product journey

1. A minimal demo sign-in chooses a starting view by role, followed by a four-step welcome guide.
2. Overview returns to CarePath's original teal-and-navy design, showing the patterns behind hospital time.
3. Groups compares four unchanged rule-based groups and ranks possible support options.
4. Explore combines a selectable age-by-visit grid with hospital-day and admission charts. Totals and both charts follow the selection.
5. Try a plan samples 2,000 variations around editable assumptions and reports a range.
6. How this works explains the admission model, clustering check, GP-type visit flags and limits.

The sign-in is demo personalisation, **not authentication**. No credentials are checked and the summary remains a static resource. An optional name and chosen role stay in sessionStorage for this browser tab; Sign out clears them. No password, account or server session is created.

## Technology

- React and TypeScript for the website
- Vite for local development and production builds
- Python, pandas, NumPy and scikit-learn for local preprocessing and models
- Tailwind 3, Tremor, shadcn/Recharts and Framer Motion for charts and accessible UI

No LLM or backend server is required. Models and simulations use fixed random seeds for repeatability.
React 18 is intentional: it satisfies Tremor's peer dependency. Vite 6 supports the installed Node 20.18 runtime.

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
npm ci
npm run prepare:data
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Verification

```bash
pytest -q
npm run build
npm run verify:data
npm run test:ui
```

Browser checks use an installed Chrome by default. Set `CAREPATH_BROWSER_CHANNEL=msedge` to use Edge instead.
They cover the tour, all groups, sliders, Python/browser simulation agreement, reduced motion, mobile overflow and accessibility toggles.
Screenshots and traces stay local in ignored `test-results/`; they can contain governed summary data.

## Models and assumptions

- **Admission associations:** LogisticRegression uses numeric age-band lower bounds, ED visit count, age-group indicators and frequency-band indicators. A stratified 80/20 patient split holds out evaluation data; scaling is learned only from training data. Accuracy, AUC and majority-class baseline are included in `model_metrics`. The top five absolute standardised coefficients are normalised against all coefficient magnitudes. Correlated features and same-year outcomes mean these weights are descriptive, not causal or future risk predictions.
- **Clustering check:** KMeans (k=4, 10 initialisations, seed 42) uses standardised visits, annual hospital days and recorded age. Cluster centres are converted back to their original units. Agreement uses the best one-to-one mapping of clusters to the four existing groups, with the full cross-tab included. It reports observed agreement without claiming clinical confirmation.
- **GP-type visits:** `avoidable_share` is the number of visits flagged 1 in the supplied GP-type attendance field divided by all ED visits in each group. This flags records for review, not proven avoidable care.
- **Ranked support:** `rank_interventions` scores a fixed five-service catalogue using observed group statistics. Scores are transparent planning heuristics (0–100), not measured service effectiveness; the top two and their weighted formulas are exported.
- **Scenarios:** Eligibility and uptake are independent Beta draws with concentration 40 and means equal to the sliders. Days saved are normal draws with standard deviation 20% of the chosen days, clipped at zero. Each total is capped at the group's recorded hospital days. Zero/100% are fixed endpoints. Python precomputes a 20% / 60% / 1.5-day default per group; TypeScript samples the same distributions interactively. Their different seeded random generators agree statistically, not bit for bit. These percentiles reflect chosen assumptions, not statistical confidence intervals.

The version-3 summary contract is in `src/types.ts`. Rebuild the summary after changing the pipeline; the app explains how to recover if it sees a missing or older summary. No individual predictions or identifiers are exported. The Explore grid uses disjoint age/frequency aggregates, so selected cells never double-count people.

## Definitions

- Older person: recorded five-year age band begins at 65 or above.
- Frequent presenter: four or more ED presentations in 2022.
- High burden: top decile of linked same-year inpatient bed-days.
- Admission: selected EDDC departure statuses documented in `src/analysis.py` and the official EDDC dictionary.

The synthetic event timestamps do not support defensible one-to-one matching between each ED presentation and inpatient episode. CarePath therefore uses person-year aggregates and does not claim that a specific ED event caused a particular inpatient episode.


### Guided planning assistant

The “Age meets visit frequency” grid has separate **Totals** and **Per-person rates** views. Totals retain People / ED visits / Hospital days shading. Rates default to **Typical days per person** (the within-cell median), with an explicitly labelled mean underneath; ED visits per person and admissions per 100 presentations are also available. The data builder calculates these from each cell's patient-year records, including zero hospital days. Empty cells have null rates. Selection totals remain additive, but cell medians are never pooled or averaged in the browser.

Guided chat uses left/right message bubbles and a **Compare roles on this question** button. Type a question, or leave the input empty to reuse your last question, to request Doctor, Nurse and Planner responses in parallel. The comparison keeps each role's result or error separate and returns to the original thread with **Back to chat**. These are demo framing controls; the inline banner explains that real deployment would use secure hospital login and role permissions. Each comparison consumes up to three Gemini requests.

Planning-category names (including Medication review) are allowed through the safety filter. Prescription phrases and drug/dose patterns remain blocked. See `tests/CHAT-ACCEPTANCE.md` for the exact regression questions and live-provider results, including the daily quota limitation encountered during the latest checks.

Run `npm install`, copy `.env.example` to `.env`, and set `GEMINI_API_KEY` locally. Never commit a real key. Start both services with `npm run dev:all` (Vite on 5173, Express on 127.0.0.1:3001). The server starts with an empty or placeholder key; provider requests then show the inline unavailable message. Manual planning remains available. Vite proxies `/api`; a production host must provide an equivalent reverse proxy to the Node service.

`GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`, verified with the configured project after the previous model reached its daily quota. Model access and quota depend on the configured Google project. Requests time out after 12 seconds server-side and 15 seconds in the browser.

The server reads only the selected group's allowed fields plus site-wide risk factors and model metrics. Current summaries contain two ranked interventions per group; the assistant does not invent additional categories. Obvious emergency, individual-care, procedure, month-breakdown and other-group requests are handled locally before contacting Gemini. Other questions use Gemini with the selected-group prompt and bounded conversation history; a keyword filter checks the reply. These safeguards are demo boundaries, not a validated clinical safety system. Do not enter real patient details. No chat messages are written to disk by this application.

Validation: `npm run test:server` checks the local boundaries, request validation, scoped prompts and output filtering. `npm run test:ui` starts both local servers and checks live local refusals, mocked provider rendering, failed-network fallback, PDF downloads, responsive layout and existing accessibility controls. Actual Gemini factual accuracy and Doctor/Nurse phrasing require a valid API key and the supplied acceptance questions; mocked responses do not establish model quality. The recurrent group is named ?Frequent and high-need? in the current summary (1,136 people; 47,180.44 hospital days, displayed as 47,180).
