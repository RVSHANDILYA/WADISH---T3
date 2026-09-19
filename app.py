from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from src.analysis import AnalysisBundle, load_and_analyse, top_burden_share


st.set_page_config(
    page_title="CarePath | Older-person pathway intelligence",
    page_icon="CP",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
<style>
    .block-container {padding-top: 1.4rem; padding-bottom: 2.5rem; max-width: 1440px;}
    [data-testid="stMetric"] {background: #fff; border: 1px solid #dde7eb; border-radius: 14px; padding: 14px 16px;}
    [data-testid="stMetricLabel"] {color: #527184;}
    [data-testid="stSidebar"] {background: #102a43;}
    [data-testid="stSidebar"] * {color: #f4f7f8;}
    .eyebrow {font-size: .78rem; letter-spacing: .13em; text-transform: uppercase; color: #0b7f82; font-weight: 750;}
    .hero {font-size: 2.15rem; line-height: 1.08; color: #102a43; font-weight: 760; margin: .3rem 0 .55rem;}
    .subhero {font-size: 1.04rem; color: #527184; max-width: 850px; margin-bottom: 1rem;}
    .insight {background: linear-gradient(120deg,#0b7f82,#075985); color: white; padding: 18px 22px; border-radius: 16px; margin: .5rem 0 1.2rem;}
    .insight strong {font-size: 1.35rem;}
    .small-note {color:#617d8c; font-size:.82rem;}
    h2, h3 {color:#102a43;}
</style>
""",
    unsafe_allow_html=True,
)


@st.cache_data(show_spinner="Linking ED and inpatient records...")
def get_bundle(ed_path: str, hm_path: str) -> AnalysisBundle:
    return load_and_analyse(ed_path, hm_path)


def find_data() -> tuple[str | None, str | None]:
    ed_default = Path("data/raw/eddc.csv")
    hm_default = Path("data/raw/hmdc.csv")
    ed_env = os.getenv("CAREPATH_EDDC_PATH")
    hm_env = os.getenv("CAREPATH_HMDC_PATH")
    ed_path = ed_env or (str(ed_default) if ed_default.exists() else None)
    hm_path = hm_env or (str(hm_default) if hm_default.exists() else None)
    return ed_path, hm_path


def data_uploader() -> tuple[str | None, str | None]:
    st.title("CarePath data setup")
    st.info(
        "Place the authorised EDDC and HMDC files at data/raw/eddc.csv and "
        "data/raw/hmdc.csv, or provide their paths with CAREPATH_EDDC_PATH and "
        "CAREPATH_HMDC_PATH. Raw data must not be committed to Git."
    )
    return None, None


ed_path, hm_path = find_data()
if not ed_path or not hm_path:
    data_uploader()
    st.stop()

try:
    bundle = get_bundle(ed_path, hm_path)
except Exception as error:
    st.error(f"The supplied files could not be analysed: {error}")
    st.stop()

patient = bundle.patient
top_ten_share = top_burden_share(patient, 0.10)
frequent = patient[patient["frequent_presenter"]]
high_recurrent = patient[
    patient["frequent_presenter"] & patient["high_burden"]
]

with st.sidebar:
    st.markdown("## CarePath")
    st.caption("Older-person pathway intelligence")
    section = st.radio(
        "Explore",
        ["System overview", "Cohort explorer", "Scenario studio", "Method & safeguards"],
    )
    st.markdown("---")
    st.caption("Population")
    st.write("Adults aged 65+ with at least one 2022 ED presentation")
    st.caption("Evidence boundary")
    st.write("Descriptive scenario modelling, not clinical advice or causal inference")

if section == "System overview":
    st.markdown('<div class="eyebrow">WA Health and Care Hackathon 2026</div>', unsafe_allow_html=True)
    st.markdown('<div class="hero">Where does older-person hospital demand concentrate?</div>', unsafe_allow_html=True)
    st.markdown(
        '<div class="subhero">CarePath links emergency and inpatient records at person-year level to reveal the cohorts behind demand, then turns those patterns into pathway-review scenarios.</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        f'<div class="insight"><strong>The highest-burden 10% account for {top_ten_share:.0%} of inpatient bed-days.</strong><br>Average utilisation hides a sharply concentrated opportunity for targeted pathway review.</div>',
        unsafe_allow_html=True,
    )

    a, b, c, d = st.columns(4)
    a.metric("People aged 65+", f"{len(patient):,}")
    b.metric("ED presentations", f"{int(patient.ed_presentations.sum()):,}")
    c.metric("ED admission dispositions", f"{int(patient.ed_admissions.sum()):,}")
    d.metric("Inpatient bed-days", f"{patient.inpatient_bed_days.sum():,.0f}")

    left, right = st.columns([1.05, 1], gap="large")
    with left:
        st.subheader("Resource concentration")
        curve = bundle.burden_curve.iloc[:: max(1, len(bundle.burden_curve) // 1200)]
        fig = go.Figure()
        fig.add_trace(
            go.Scatter(
                x=curve.cumulative_patients * 100,
                y=curve.cumulative_bed_days * 100,
                mode="lines",
                line=dict(color="#0EA5A8", width=4),
                fill="tozeroy",
                fillcolor="rgba(14,165,168,.12)",
                name="Observed concentration",
            )
        )
        fig.add_trace(
            go.Scatter(
                x=[0, 100], y=[0, 100], mode="lines",
                line=dict(color="#a9bac3", dash="dash"), name="Equal distribution"
            )
        )
        fig.update_layout(
            xaxis_title="Cumulative share of patients (%)",
            yaxis_title="Cumulative share of inpatient bed-days (%)",
            margin=dict(l=10, r=10, t=10, b=10), height=390,
            legend=dict(orientation="h", y=1.08),
        )
        st.plotly_chart(fig, width="stretch")
    with right:
        st.subheader("Two different operational problems")
        display = bundle.cohort.copy()
        colours = {
            "Occasional / lower burden": "#9FB3C8",
            "Acute complex": "#F59E0B",
            "Frequent / lower burden": "#38BDF8",
            "High-burden recurrent": "#0B7F82",
        }
        fig = px.scatter(
            display,
            x="patient_share",
            y="bed_day_share",
            size="patients",
            color="cohort",
            hover_data={"patients": ":,", "patient_share": ":.1%", "bed_day_share": ":.1%"},
            color_discrete_map=colours,
            labels={"patient_share": "Share of patients", "bed_day_share": "Share of bed-days", "cohort": "Cohort"},
        )
        fig.update_traces(marker=dict(line=dict(width=1, color="white")))
        fig.update_layout(
            xaxis_tickformat=".0%", yaxis_tickformat=".0%", height=390,
            margin=dict(l=10, r=10, t=10, b=10), legend=dict(orientation="h", y=-.25)
        )
        st.plotly_chart(fig, width="stretch")
    st.caption(
        "Key interpretation: recurrent presentation and high inpatient burden overlap, but they are not the same problem. CarePath keeps acute-complex and recurrent-high-burden cohorts visible separately."
    )

elif section == "Cohort explorer":
    st.markdown('<div class="eyebrow">Cohort explorer</div>', unsafe_allow_html=True)
    st.markdown('<div class="hero">Follow demand from age to recurrence to burden</div>', unsafe_allow_html=True)
    cohort_names = list(bundle.cohort["cohort"])
    selected = st.selectbox("Choose a cohort", cohort_names, index=cohort_names.index("High-burden recurrent"))
    row = bundle.cohort.loc[bundle.cohort.cohort.eq(selected)].iloc[0]
    filtered = patient.loc[patient.cohort.eq(selected)]

    a, b, c, d = st.columns(4)
    a.metric("Patients", f"{int(row.patients):,}", f"{row.patient_share:.1%} of cohort")
    b.metric("ED presentations", f"{int(row.ed_presentations):,}")
    c.metric("Patients ever admitted", f"{row.patients_with_admission:.1%}")
    d.metric("Bed-day share", f"{row.bed_day_share:.1%}")

    left, right = st.columns([1.2, 1], gap="large")
    with left:
        st.subheader("Admission gradient by presentation frequency")
        fig = px.bar(
            bundle.frequency,
            x="frequency_band",
            y="patients_with_admission",
            color="inpatient_bed_days",
            color_continuous_scale=["#D8F3F1", "#0B7F82"],
            text=bundle.frequency["patients_with_admission"].map(lambda x: f"{x:.0%}"),
            labels={"frequency_band": "ED presentations per person", "patients_with_admission": "Share with an admission", "inpatient_bed_days": "Bed-days"},
        )
        fig.update_layout(yaxis_tickformat=".0%", coloraxis_showscale=False, height=390, margin=dict(l=10,r=10,t=10,b=10))
        st.plotly_chart(fig, width="stretch")
    with right:
        st.subheader("Selected cohort profile")
        profile = pd.DataFrame(
            {
                "Measure": ["Median age band", "Median ED presentations", "Median inpatient bed-days", "Potentially avoidable ED flags"],
                "Value": [
                    f"{filtered.age_band.median():.0f}-{filtered.age_band.median()+4:.0f}",
                    f"{filtered.ed_presentations.median():.0f}",
                    f"{filtered.inpatient_bed_days.median():.1f}",
                    f"{int(filtered.potentially_avoidable_presentations.sum()):,}",
                ],
            }
        )
        st.dataframe(profile, hide_index=True, width="stretch")
        st.markdown("**Pathway review prompts**")
        if selected == "High-burden recurrent":
            st.write("Geriatric assessment, coordinated discharge, medication review, community rapid response.")
        elif selected == "Acute complex":
            st.write("Early multidisciplinary assessment, discharge readiness, rehabilitation or hospital-at-home eligibility.")
        elif selected == "Frequent / lower burden":
            st.write("Primary care access, rapid outpatient follow-up, potentially avoidable presentation review.")
        else:
            st.write("Maintain standard pathway and monitor for escalation in recurrence or burden.")
    st.warning("These prompts identify services for assessment; they are not treatment recommendations.")

elif section == "Scenario studio":
    st.markdown('<div class="eyebrow">Scenario studio</div>', unsafe_allow_html=True)
    st.markdown('<div class="hero">Turn retrospective burden into a transparent planning scenario</div>', unsafe_allow_html=True)
    st.write("Model a service-planning hypothesis without claiming that the synthetic data proves causal impact.")

    target = st.selectbox("Target cohort", ["High-burden recurrent", "Acute complex"])
    target_row = bundle.cohort.loc[bundle.cohort.cohort.eq(target)].iloc[0]
    eligible_share = st.slider("Share assessed as pathway-eligible", 0, 50, 20, 5) / 100
    uptake = st.slider("Eligible patients taking up the pathway", 0, 100, 60, 5) / 100
    assumed_days = st.slider("Assumed inpatient bed-days avoided per participating patient", 0.0, 5.0, 1.5, 0.25)
    participating = int(round(target_row.patients * eligible_share * uptake))
    scenario_days = participating * assumed_days

    a, b, c = st.columns(3)
    a.metric("Patients reviewed", f"{int(round(target_row.patients * eligible_share)):,}")
    b.metric("Participating patients", f"{participating:,}")
    c.metric("Modelled bed-days released", f"{scenario_days:,.0f}")
    fig = go.Figure(
        go.Indicator(
            mode="gauge+number",
            value=scenario_days,
            number={"suffix": " days", "font": {"color": "#102A43"}},
            gauge={
                "axis": {"range": [0, max(1, target_row.inpatient_bed_days * 0.12)]},
                "bar": {"color": "#0EA5A8"},
                "bgcolor": "#DDE7EB",
                "steps": [{"range": [0, target_row.inpatient_bed_days * 0.05], "color": "#E8F6F6"}],
            },
            title={"text": "Illustrative annual capacity opportunity"},
        )
    )
    fig.update_layout(height=330, margin=dict(l=30, r=30, t=60, b=15))
    st.plotly_chart(fig, width="stretch")
    st.info(
        "Scenario only: the eligibility, uptake and avoided-days assumptions are user-controlled. "
        "They are not estimated treatment effects and must be validated prospectively."
    )

else:
    st.markdown('<div class="eyebrow">Method and safeguards</div>', unsafe_allow_html=True)
    st.markdown('<div class="hero">Explainable by design</div>', unsafe_allow_html=True)
    st.markdown(
        """
### Cohort definitions

- **Frequent presentation:** four or more ED presentations during 2022.
- **High inpatient burden:** at or above the 90th percentile of linked same-year inpatient bed-days.
- **Admission:** EDDC departure status indicating ward/other admission, transfer for admission, observation admission, hospital-in-the-home return or discharge after admission.

### Evidence boundaries

- The files are synthetic and representative; results demonstrate analytical capability rather than current operational performance.
- EDDC and HMDC are linked at person level. We aggregate within the year and do not assert that a specific inpatient episode was caused by a specific ED presentation.
- Age is supplied in five-year bands, so the interface does not imply exact ages.
- Scenario outputs are transparent arithmetic, not causal estimates or clinical recommendations.
- Raw or derived data must not be placed in a public repository without Data Custodian approval.
"""
    )
    st.subheader("Definitions used in the live build")
    methods = pd.DataFrame(
        [
            ["Population", "People aged 65+ with at least one 2022 ED presentation"],
            ["Repeat use", "Count of ED presentations per linked person during 2022"],
            ["Resource burden", "Sum of same-year HMDC episode duration per linked person"],
            ["High burden threshold", f"90th percentile: {bundle.burden_threshold:.1f} bed-days"],
            ["Primary use", "Service planning and pathway-review prioritisation"],
        ],
        columns=["Element", "Definition"],
    )
    st.dataframe(methods, hide_index=True, width="stretch")
