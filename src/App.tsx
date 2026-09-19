import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card, Metric } from "@tremor/react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import { Accessibility, Activity, ArrowRight, BarChart3, Check, ChevronLeft, ChevronRight, CircleHelp, Compass, HeartPulse, Home, Info, Lightbulb, RefreshCcw, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { ClusterChart, ConcentrationChart, FrequencyChart, RiskChart } from "./components/DashboardCharts";
import { simulateScenario } from "./lib/simulation";
import type { Cohort, Summary } from "./types";

type Page = "overview" | "explore" | "scenario" | "method";
const nf = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const pct = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`;
const cardClass = "border border-slate-100 shadow-sm rounded-xl";
const tourSteps = [
  { title: "A clearer picture of care.", body: "CarePath helps hospital teams understand patterns in visits and hospital stays for people aged 65 and over.", icon: Compass },
  { title: "Start with the bigger picture.", body: "The overview shows where hospital days are used. A bed-day means one day spent admitted in hospital.", icon: Activity },
  { title: "Get to know the four groups.", body: "Compare how often people visit ED and how much time they spend in hospital. Explore support options ranked from these group patterns.", icon: Users },
  { title: "Try a plan, see a range.", body: "Change your assumptions to explore possible hospital days saved. These are planning scenarios, not promises or advice for an individual person.", icon: Lightbulb },
];

function savedTour() { try { return localStorage.getItem("carepath-tour") !== "done"; } catch { return true; } }

function App() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("overview");
  const [selectedId, setSelectedId] = useState("recurrent");
  const [tour, setTour] = useState(0);
  const [showTour, setShowTour] = useState(savedTour);
  const [a11y, setA11y] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [contrast, setContrast] = useState(false);
  const reduced = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/summary.json", { cache: "no-store", signal: controller.signal })
      .then(response => {
        if (!response.ok || !response.headers.get("content-type")?.includes("json")) throw new Error("The local data summary needs to be prepared.");
        return response.json();
      }).then((summary: Summary) => {
        if (summary.schemaVersion !== 2 || !summary.risk_factors || !summary.cluster_validation || !summary.cohorts?.length)
          throw new Error("Please rebuild the local summary for this version of CarePath.");
        setData(summary);
      }).catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("large-text", largeText);
    document.documentElement.classList.toggle("high-contrast", contrast);
    return () => { document.documentElement.classList.remove("large-text", "high-contrast"); };
  }, [largeText, contrast]);
  const navigate = (next: Page) => { setPage(next); mainRef.current?.focus(); window.scrollTo({ top: 0, behavior: "instant" }); };
  const closeTour = () => {
    setShowTour(false);
    try { localStorage.setItem("carepath-tour", "done"); } catch { /* Tour still closes with storage disabled. */ }
  };
  if (error) return <div className="state-screen"><Card className={cardClass}><Info /><h1>One local setup step remains</h1><p>{error}</p><code>python scripts/build_summary.py</code><button className="primary" onClick={() => window.location.reload()}>Try again</button></Card></div>;
  if (!data) return <div className="state-screen" role="status"><HeartPulse size={40} /><h1>Preparing CarePath</h1><p>Loading your local planning summary…</p></div>;
  return <MotionConfig reducedMotion="user"><div className="app font-sans">
    <Header page={page} setPage={navigate} onGuide={() => { setTour(0); setShowTour(true); }} onAccessibility={() => setA11y(true)} />
    <main id="main-content" tabIndex={-1} ref={mainRef}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={page} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -5 }} transition={{ duration: reduced ? 0 : .18 }}>
          {page === "overview" && <Overview data={data} setPage={navigate} />}
          {page === "explore" && <Explore data={data} selectedId={selectedId} setSelectedId={setSelectedId} setPage={navigate} />}
          {page === "scenario" && <Scenario data={data} cohortId={selectedId} setCohortId={setSelectedId} />}
          {page === "method" && <Method data={data} />}
        </motion.div>
      </AnimatePresence>
    </main>
    <footer className="shell"><span><HeartPulse size={18} /><strong>CarePath</strong> · Better conversations about care</span><p>Synthetic 2022 data · Group planning only</p></footer>
    {showTour && <GuidedTour step={tour} setStep={setTour} onClose={closeTour} />}
    {a11y && <AccessibilityPanel largeText={largeText} setLargeText={setLargeText} contrast={contrast} setContrast={setContrast} onClose={() => setA11y(false)} />}
  </div></MotionConfig>;
}

function Header({ page, setPage, onGuide, onAccessibility }: { page: Page; setPage: (p: Page) => void; onGuide: () => void; onAccessibility: () => void }) {
  const links = [{ id: "overview", label: "Overview", icon: Home }, { id: "explore", label: "Groups", icon: Users }, { id: "scenario", label: "Try a plan", icon: Sparkles }, { id: "method", label: "How this works", icon: ShieldCheck }] as const;
  return <header className="site-header"><div className="header-inner">
    <button className="brand" onClick={() => setPage("overview")} aria-label="CarePath home"><span className="brand-mark"><HeartPulse /></span><span><strong>CarePath</strong><small>Care planning, made clearer</small></span></button>
    <nav aria-label="Primary navigation">{links.map(({ id, label, icon: Icon }) => <button key={id} aria-current={page === id ? "page" : undefined} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
    <div className="header-actions"><button className="icon-button" onClick={onAccessibility} aria-label="Accessibility settings"><Accessibility size={21} /></button><button className="secondary guide-button" onClick={onGuide}><CircleHelp size={18} />Guide me</button></div>
  </div></header>;
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduced ? 0 : .18 }}>{children}</motion.div>;
}
function Panel({ title, eyebrow, children, className = "" }: { title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return <Reveal className={className}><Card className={`${cardClass} panel h-full`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{children}</Card></Reveal>;
}
function PageHeading({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return <div className="page-heading"><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{children}</p></div>;
}
function BedDaysGloss() { return <p className="gloss"><Info size={18} /><span>Bed-days — the total time people spent admitted in hospital, measured in days. One person staying three days uses three bed-days.</span></p>; }
function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <Reveal><Card className={`${cardClass} metric-card`}><p className="metric-label">{label}</p><Metric>{value}</Metric><p className="caption">{helper}</p></Card></Reveal>;
}

function Overview({ data, setPage }: { data: Summary; setPage: (p: Page) => void }) {
  return <div className="shell page">
    <section className="welcome-grid">
      <div className="welcome-copy"><span className="eyebrow"><span className="status-dot" />WA health & care · Planning overview</span><h1>See the patterns.<br /><span>Plan better care.</span></h1><p>A shared view of emergency visits and hospital stays for people aged 65+. Understand who needs more support, and explore what could help.</p><div className="hero-actions"><button className="primary" onClick={() => setPage("explore")}>See the patient groups <ArrowRight size={19} /></button><button className="text-button" onClick={() => setPage("method")}>How this works <ArrowRight size={17} /></button></div><div className="population-note"><ShieldCheck size={18} />Synthetic data · No individual patient advice</div></div>
      <Reveal><Card className={`${cardClass} signal-card`}><span className="eyebrow"><Activity size={18} />The bigger picture</span><div className="signal-value">{pct(data.metrics.topTenBedDayShare)}</div><h2>of hospital days are used by 10% of people.</h2><p>Some people visit often. Others visit rarely but need much longer stays. Both patterns matter.</p><div className="signal-strip" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <span className={i === 9 ? "highlight" : ""} key={i}><Users size={22} /></span>)}</div><p className="caption">The 10% with the most hospital days during 2022.</p></Card></Reveal>
    </section>
    <div className="metric-grid overview-metrics">
      <MetricCard label="People aged 65+" value={nf.format(data.metrics.patients)} helper="At least one ED visit in 2022" />
      <MetricCard label="ED visits" value={nf.format(data.metrics.edPresentations)} helper="Visits across all four groups" />
      <MetricCard label="Hospital days" value={nf.format(data.metrics.inpatientBedDays)} helper="Total bed-days over the year" />
      <MetricCard label="Patient groups" value="4" helper="Visit frequency × hospital time" />
    </div>
    <BedDaysGloss />
    <div className="overview-grid">
      <Panel title="Where hospital time adds up" eyebrow="Look beyond the average"><p>Read from left to right: people with fewer hospital days come first. A steeper rise near the end means more days are used by a smaller group.</p><ConcentrationChart points={data.concentration} /></Panel>
      <Panel title="Four patterns. Different needs." eyebrow="Meet the groups"><div className="group-preview">{data.cohorts.map(g => <button key={g.id} onClick={() => setPage("explore")}><span className="group-dot" style={{ background: g.color }} /><span><strong>{g.name}</strong><small>{nf.format(g.patients)} people · {pct(g.patientShare, 1)}</small></span><ArrowRight size={18} /></button>)}</div><div className="soft-note"><Lightbulb size={23} /><p>Start with a group, review its needs, then try your own support plan.</p></div><button className="secondary full" onClick={() => setPage("scenario")}>Try a plan <ArrowRight size={18} /></button></Panel>
    </div>
  </div>;
}

function Explore({ data, selectedId, setSelectedId, setPage }: { data: Summary; selectedId: string; setSelectedId: (id: string) => void; setPage: (p: Page) => void }) {
  const cohort = data.cohorts.find(c => c.id === selectedId) ?? data.cohorts[0];
  return <div className="shell page">
    <PageHeading kicker="Patient groups" title="See the patient groups">Choose a group to understand its visits, hospital stays and possible support needs. These names describe patterns in records, not anyone’s diagnosis.</PageHeading>
    <div className="cohort-tabs" role="group" aria-label="Choose a patient group">{data.cohorts.map(g => <button key={g.id} aria-pressed={g.id === cohort.id} className={g.id === cohort.id ? "selected" : ""} onClick={() => setSelectedId(g.id)}><span className="group-dot" style={{ background: g.color }} /><span>{g.name}</span></button>)}</div>
    <section className="group-banner"><div><span className="eyebrow">Your selected group</span><h2>{cohort.name}</h2><p>{cohort.description}</p></div><div className="group-total"><strong>{nf.format(cohort.patients)}</strong><span>people · {pct(cohort.patientShare, 1)} of all people</span></div></section>
    <div className="metric-grid" key={cohort.id}>
      <MetricCard label="ED visits" value={nf.format(cohort.edPresentations)} helper={`${cohort.medianPresentations} typical visits per person`} />
      <MetricCard label="Admitted at least once" value={pct(cohort.admissionShare, 1)} helper="People with an ED admission recorded" />
      <MetricCard label="Hospital days" value={nf.format(cohort.inpatientBedDays)} helper={`${pct(cohort.bedDayShare, 1)} of all recorded hospital days`} />
      <MetricCard label="Typical age" value={`${cohort.medianAgeBand}–${cohort.medianAgeBand + 4}`} helper="Middle age band; not an exact age" />
    </div>
    <BedDaysGloss />
    <div className="two-column">
      <Panel title="What could help this group" eyebrow="Ranked support options">
        <p>Computed, ranked suggestions for planners — not instructions for treating any one person.</p>
        <ol className="interventions">{cohort.recommended_interventions.map((item, i) => <li key={item.name}><span className="rank-number">{i + 1}</span><div><h3>{item.name}</h3><p>{item.reason}</p><div className="score-track"><span style={{ width: `${item.score}%` }} /></div></div><strong className="score">{item.score.toFixed(1)}<small>/100</small></strong></li>)}</ol>
        <details><summary>How these scores are worked out</summary><p>Scores combine GP-type visit share, admission share, typical visits, hospital days and recorded age. Visit scores reach their maximum at 10 visits a year, hospital-day scores at 14 days, and age scores at age-band 90; the displayed weights are planning choices, not evidence that a service works.</p></details>
        <button className="primary full" onClick={() => setPage("scenario")}>Try a plan for this group <ArrowRight size={18} /></button>
      </Panel>
      <Panel title="A closer look at support needs" eyebrow="Observed in this group">
        <div className="detail-metric"><span>GP-type ED visits</span><strong>{pct(cohort.avoidable_share, 1)}</strong></div><p>{nf.format(cohort.potentiallyAvoidable)} of {nf.format(cohort.edPresentations)} visits carry the data’s potentially avoidable GP-type flag. This suggests visits to review, not proof that ED care was unnecessary.</p>
        <div className="detail-metric"><span>Typical hospital stay</span><strong>{cohort.medianBedDays.toFixed(1)} days</strong></div><p>The middle person’s total hospital days across the year, including people with no stay. This is not the length of one admission.</p>
        <div className="soft-note"><ShieldCheck size={22} /><p>Some records with an admission may include a transfer. All figures describe groups over a year.</p></div>
      </Panel>
    </div>
    <div className="two-column section-gap">
      <Panel title="What is linked with admission?" eyebrow="Admission model · all groups"><RiskChart data={data} /></Panel>
      <Panel title="Repeat visits and admission" eyebrow="Across all groups"><p>Share of people with at least one ED admission recorded during 2022, by number of visits.</p><FrequencyChart bands={data.frequency} /><p className="caption">More visits also mean more chances to have an admission. This chart does not predict what happens at the next visit.</p></Panel>
    </div>
  </div>;
}

function Scenario({ data, cohortId, setCohortId }: { data: Summary; cohortId: string; setCohortId: (id: string) => void }) {
  const assumptions = data.scenario_assumptions;
  const [eligible, setEligible] = useState(assumptions.eligible_pct);
  const [uptake, setUptake] = useState(assumptions.uptake_pct);
  const [days, setDays] = useState(assumptions.days_per_patient);
  const cohort = data.cohorts.find(c => c.id === cohortId) ?? data.cohorts[0];
  const result = useMemo(() => simulateScenario(cohort, eligible, uptake, days, assumptions.n_draws), [cohort, eligible, uptake, days, assumptions.n_draws]);
  const defaultPlan = eligible === assumptions.eligible_pct && uptake === assumptions.uptake_pct && days === assumptions.days_per_patient;
  return <div className="shell page">
    <PageHeading kicker="Try a plan" title="Small changes. A range of possibilities.">Choose a group and set your assumptions. We try 2,000 variations around them to show a range of possible hospital days saved.</PageHeading>
    <BedDaysGloss />
    <div className="scenario-layout">
      <Panel title="Your assumptions" eyebrow="You set the plan">
        <label className="field-label">Patient group<select value={cohort.id} onChange={e => setCohortId(e.target.value)}>{data.cohorts.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
        <RangeControl label="Checked for extra support" value={eligible} setValue={setEligible} min={0} max={100} step={5} suffix="%" helper="Share of this group assumed suitable after a support check." />
        <RangeControl label="How many agree to join" value={uptake} setValue={setUptake} min={0} max={100} step={5} suffix="%" helper="Share of those suitable who take up the support." />
        <RangeControl label="Hospital days saved per person" value={days} setValue={setDays} min={0} max={5} step={.25} suffix=" days" helper="Your assumption about the effect of support; it is not measured in these records." />
        <button className="text-button" onClick={() => { setEligible(assumptions.eligible_pct); setUptake(assumptions.uptake_pct); setDays(assumptions.days_per_patient); }}><RefreshCcw size={17} />Reset assumptions</button>
      </Panel>
      <Panel title="Possible hospital days saved" eyebrow="2,000 simulated plans" className="simulation-panel">
        <div aria-live="polite" aria-atomic="true" data-testid="simulation-result"><div className="simulation-main"><strong>{nf.format(result.p50)}</strong><span>middle estimate · hospital days</span></div><div className="range-results"><div><span>Lower estimate</span><strong>{nf.format(result.p10)}</strong><small>10th percentile</small></div><div><span>Upper estimate</span><strong>{nf.format(result.p90)}</strong><small>90th percentile</small></div></div><p className="range-explanation">Eight out of ten simulated plans fall between <strong>{nf.format(result.p10)}</strong> and <strong>{nf.format(result.p90)}</strong> days.</p><div className="detail-metric"><span>Average across all variations</span><strong>{nf.format(result.mean)} days</strong></div></div>
        <p>Every variation is capped at this group’s {nf.format(cohort.inpatientBedDays)} recorded hospital days. This range reflects your assumptions, not a forecast or a guarantee.</p>
        {defaultPlan && <p className="caption">The saved data-build example has a middle estimate of {nf.format(cohort.default_simulation.p50)} days. Fresh browser samples can differ slightly.</p>}
      </Panel>
    </div>
    <div className="soft-note section-gap"><Info size={25} /><div><h3>What changes between the 2,000 variations?</h3><p>The checked-for-support and joining rates vary around your percentages. Days saved vary around your chosen value by a modest amount; 0% or zero days always gives zero savings.</p><details><summary>See the simulation assumptions</summary><p>We use independent Beta distributions with concentration 40 for the two percentages, and a normal distribution with a standard deviation of 20% of the chosen days. Days cannot be negative; 0% and 100% stay fixed. A fixed random seed keeps repeated calculations steady. These ranges are chosen assumptions, not uncertainty measured from the records.</p></details></div></div>
  </div>;
}

function Method({ data }: { data: Summary }) {
  const metrics = data.model_metrics;
  const agreement = data.cluster_validation.agreement_rate;
  return <div className="shell page">
    <PageHeading kicker="How this works" title="Clear evidence. Honest limits.">CarePath helps teams ask better planning questions. It never identifies or advises any single named patient — it only describes groups, for hospital planning.</PageHeading>
    <BedDaysGloss />
    <div className="two-column">
      <Panel title="What the admission model found" eyebrow="A check against held-out records"><p>{data.risk_factors.length ? `The strongest model factors were ${data.risk_factors.slice(0, 2).map(f => f.factor.toLowerCase()).join(" and ")}.` : "There is not enough variation to fit an admission model."} These are links in the same year’s records, not causes or predictions for someone’s next visit.</p><RiskChart data={data} /><div className="model-metrics"><span>Test accuracy <strong>{metrics.accuracy === null ? "Unavailable" : pct(metrics.accuracy, 1)}</strong></span><span>AUC <strong>{metrics.auc?.toFixed(2) ?? "Unavailable"}</strong></span><span>Simple baseline <strong>{metrics.baseline_accuracy === null ? "Unavailable" : pct(metrics.baseline_accuracy, 1)}</strong></span></div><details><summary>What these checks mean</summary><p>The model learns from 80% of people ({nf.format(metrics.train_size)}) and is checked on the other 20% ({nf.format(metrics.test_size)}). Accuracy is the share classified correctly; the baseline always chooses the more common training outcome. AUC measures how well the model separates people with and without an admission (0.5 is chance; 1 is perfect).</p><p>Logistic regression uses numeric recorded age, ED visit count, age-group indicators and visit-frequency indicators. Scaling is fitted only to training data. Same-year visit counts and admissions are related by design; there is no future-year or external validation.</p></details></Panel>
      <Panel title="Do the four groups fit the data?" eyebrow="Independent clustering check"><p>{agreement === null ? "There are not enough distinct patterns for a four-way clustering check." : `An independent grouping method matched our four groups for ${agreement.toFixed(1)}% of people.`} This is a check of how closely the patterns agree, not proof that the groups are clinically correct.</p><ClusterChart data={data} /><details><summary>How the comparison works</summary><p>KMeans finds four patterns using ED visit count, total hospital days and numeric recorded age, each standardised to a common scale. It is independent of the group labels but uses the same records; a partial match is expected because the four original groups use two fixed cut-offs.</p></details></Panel>
    </div>
    <Panel title="Which visits might have been supported by a GP?" eyebrow="A flag for further review" className="section-gap"><p>The GP-type flag identifies ED visits that could plausibly have been supported in primary care. It does not tell us whether a GP was available or whether an individual visit was safe to avoid.</p><div className="avoidable-grid">{data.cohorts.map(g => <div key={g.id}><span className="group-dot" style={{ background: g.color }} /><h3>{g.name}</h3><strong>{pct(g.avoidable_share, 1)}</strong><p>{nf.format(g.potentiallyAvoidable)} of {nf.format(g.edPresentations)} visits</p></div>)}</div></Panel>
    <div className="two-column section-gap">
      <Panel title="The rules stay simple" eyebrow="Four groups"><p>Frequent means four or more ED visits in 2022. High-need hospital use means at least {data.metrics.highBurdenThreshold} total days in hospital — the cut-off for the highest 10% of people’s stays.</p><p>The model and clustering check do not change these rules. Ties at the cut-off can place more than 10% in the high-use groups.</p></Panel>
      <Panel title="What the records can tell us" eyebrow="Protecting the boundaries"><p>We link emergency and hospital records for the same person over the same year. We cannot say that a particular ED visit caused a particular hospital stay.</p><p>Age is supplied in five-year bands. The browser only receives group summaries, never patient identifiers or individual model scores.</p></Panel>
    </div>
  </div>;
}

function RangeControl({ label, value, setValue, min, max, step, suffix, helper }: { label: string; value: number; setValue: (v: number) => void; min: number; max: number; step: number; suffix: string; helper: string }) {
  return <label className="range-control"><span><strong>{label}</strong><output>{value}{suffix}</output></span><input aria-label={label} type="range" value={value} onChange={e => setValue(Number(e.target.value))} min={min} max={max} step={step} /><small>{helper}</small></label>;
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, select, a[href], [tabindex='0']") ?? []);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const list = focusable(), first = list[0], last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop"><div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`modal-card border border-slate-100 shadow-sm rounded-2xl ${wide ? "tour-modal" : ""}`}><button className="modal-close icon-button" aria-label={`Close ${title}`} onClick={onClose}><X /></button>{children}</div></div>;
}
function GuidedTour({ step, setStep, onClose }: { step: number; setStep: (step: number) => void; onClose: () => void }) {
  const item = tourSteps[step], Icon = item.icon;
  return <Modal title="guided tour" onClose={onClose} wide><div className="tour-art"><span><Icon size={48} /></span><strong>CarePath</strong><p>A little context.<br />A clearer next step.</p></div><div className="tour-content"><span className="eyebrow">Welcome · {step + 1} of {tourSteps.length}</span><div aria-live="polite"><h2>{item.title}</h2><p>{item.body}</p></div><div className="tour-progress" aria-label={`Step ${step + 1} of 4`}>{tourSteps.map((_, i) => <i className={i <= step ? "done" : ""} key={i} />)}</div><div className="tour-actions"><button className="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}><ChevronLeft size={18} />Back</button>{step < tourSteps.length - 1 ? <button className="primary" onClick={() => setStep(step + 1)}>Next<ChevronRight size={18} /></button> : <button className="primary" onClick={onClose}><Check size={18} />Start exploring</button>}</div></div></Modal>;
}
function AccessibilityPanel({ largeText, setLargeText, contrast, setContrast, onClose }: { largeText: boolean; setLargeText: (v: boolean) => void; contrast: boolean; setContrast: (v: boolean) => void; onClose: () => void }) {
  return <Modal title="accessibility settings" onClose={onClose}><Accessibility size={30} /><h2>Make CarePath comfortable</h2><p>These settings apply immediately.</p><label className="toggle-row"><span><strong>Larger text</strong><small>Increase text throughout the website</small></span><input type="checkbox" checked={largeText} onChange={e => setLargeText(e.target.checked)} /></label><label className="toggle-row"><span><strong>High contrast</strong><small>Stronger borders and darker text</small></span><input type="checkbox" checked={contrast} onChange={e => setContrast(e.target.checked)} /></label><button className="primary full" onClick={onClose}>Done</button></Modal>;
}

export default App;
