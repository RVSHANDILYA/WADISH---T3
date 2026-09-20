import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card, Metric } from "@tremor/react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import { Accessibility, Activity, ArrowRight, BedDouble, Check, ChevronLeft, ChevronRight, CircleHelp, Compass, Grid2X2, HeartPulse, Home, Info, Lightbulb, LogOut, RefreshCcw, Search, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { ClusterChart, ConcentrationChart, FrequencyChart, RiskChart } from "./components/DashboardCharts";
import { PlanningChat, opening, type ChatMessage } from "./components/PlanningChat";
import { downloadPlan } from "./lib/planPdf";
import { simulateScenario } from "./lib/simulation";
import type { Cohort, Summary } from "./types";
import { SignIn } from "./components/SignIn";
import { EvidenceExplorer } from "./components/EvidenceExplorer";
import { clearSession, loadSession, roles, saveSession, type DemoSession } from "./lib/session";

type Page = "overview" | "explore" | "evidence" | "scenario" | "method";
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
  const [session, setSession] = useState(loadSession);
  const [page, setPage] = useState<Page>(() => roles.find(role => role.id === session?.roleId)?.home ?? "overview");
  const [selectedId, setSelectedId] = useState<string>(() => roles.find(role => role.id === session?.roleId)?.group ?? "recurrent");
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
        if (summary.schemaVersion !== 3 || !summary.exploration?.length || summary.exploration.some(cell => !("median_bed_days_per_person" in cell)) || !summary.risk_factors || !summary.cluster_validation || !summary.cohorts?.length)
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
  const signIn = (next: DemoSession) => {
    const role = roles.find(item => item.id === next.roleId)!;
    saveSession(next); setSession(next); setPage(role.home); setSelectedId(role.group);
    setShowTour(savedTour()); window.scrollTo({ top: 0, behavior: "instant" });
  };
  const signOut = () => { clearSession(); setSession(null); setShowTour(false); setA11y(false); window.scrollTo({ top: 0, behavior: "instant" }); };
  if (error) return <div className="state-screen"><Card className={cardClass}><Info /><h1>One local setup step remains</h1><p>{error}</p><code>python scripts/build_summary.py</code><button className="primary" onClick={() => window.location.reload()}>Try again</button></Card></div>;
  if (!data) return <div className="state-screen" role="status"><HeartPulse size={40} /><h1>Preparing CarePath</h1><p>Loading your local planning summary…</p></div>;
  if (!session) return <MotionConfig reducedMotion="user"><SignIn data={data} onSignIn={signIn} onAccessibility={() => setA11y(true)} />{a11y && <AccessibilityPanel largeText={largeText} setLargeText={setLargeText} contrast={contrast} setContrast={setContrast} onClose={() => setA11y(false)} />}</MotionConfig>;
  return <MotionConfig reducedMotion="user"><div className="app font-sans">
    <Header page={page} setPage={navigate} session={session} onSignOut={signOut} onGuide={() => { setTour(0); setShowTour(true); }} onAccessibility={() => setA11y(true)} />
    <main id="main-content" tabIndex={-1} ref={mainRef}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={page} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -5 }} transition={{ duration: reduced ? 0 : .18 }}>
          {page === "overview" && <Overview data={data} setPage={navigate} />}
          {page === "explore" && <Explore data={data} selectedId={selectedId} setSelectedId={setSelectedId} setPage={navigate} />}
          {page === "evidence" && <EvidenceExplorer data={data} />}
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

function Header({ page, setPage, session, onSignOut, onGuide, onAccessibility }: { page: Page; setPage: (p: Page) => void; session: DemoSession; onSignOut: () => void; onGuide: () => void; onAccessibility: () => void }) {
  const links = [{ id: "overview", label: "Overview", icon: Home }, { id: "explore", label: "Groups", icon: Users }, { id: "evidence", label: "Explore", icon: Search }, { id: "scenario", label: "Try a plan", icon: Sparkles }, { id: "method", label: "How this works", icon: ShieldCheck }] as const;
  return <header className="site-header"><div className="header-inner">
    <button className="brand" onClick={() => setPage("overview")} aria-label="CarePath home"><span className="brand-mark"><HeartPulse /></span><span><strong>CarePath</strong><small>Care planning, made clearer</small></span></button>
    <nav aria-label="Primary navigation">{links.map(({ id, label, icon: Icon }) => <button key={id} aria-current={page === id ? "page" : undefined} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
    <div className="header-actions"><button className="icon-button" onClick={onAccessibility} aria-label="Accessibility settings"><Accessibility size={21} /></button><button className="secondary guide-button" onClick={onGuide}><CircleHelp size={18} />Guide me</button><button className="icon-button" onClick={onSignOut} aria-label="Sign out" title={`Sign out · ${session.name}`}><LogOut size={19} /></button></div>
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
function MetricCard({ label, value, helper, icon }: { label: string; value: string; helper: string; icon?: ReactNode }) {
  return <Reveal><Card className={`${cardClass} metric-card`}>{icon && <span className="metric-icon">{icon}</span>}<p className="metric-label">{label}</p><Metric>{value}</Metric><p className="caption">{helper}</p></Card></Reveal>;
}

function Overview({ data, setPage }: { data: Summary; setPage: (p: Page) => void }) {
  const compact = new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 });
  const featured = data.cohorts.filter(group => group.id === "acute" || group.id === "recurrent");
  return <div className="overview-page">
    <section className="hero shell">
      <div className="hero-copy"><span className="eyebrow"><Sparkles size={16} />A clearer view of care · Ages 65+</span><h1>Find the care pathways<br /><span>behind the numbers.</span></h1><p>Understand emergency visits and hospital stays. See who needs more support, and explore what better care could look like.</p><div className="hero-actions"><button className="primary" onClick={() => setPage("explore")}>See the patient groups <ArrowRight size={19} /></button><button className="secondary" onClick={() => setPage("evidence")}><Search size={18} />Explore the evidence</button></div><p className="evidence-note"><ShieldCheck size={17} />Synthetic 2022 data · Group planning only</p></div>
      <div className="hero-visual" aria-label="CarePath connects ED visits, hospital days and four patient groups">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="pulse-core"><HeartPulse size={40} /><strong>65+</strong><span>People first</span></div>
        <div className="orbit-card card-ed"><Activity size={21} /><span>ED visits</span><strong>{compact.format(data.metrics.edPresentations)}</strong></div>
        <div className="orbit-card card-care"><Grid2X2 size={21} /><span>Patient groups</span><strong>4</strong></div>
        <div className="orbit-card card-beds"><BedDouble size={21} /><span>Hospital days</span><strong>{compact.format(data.metrics.inpatientBedDays)}</strong></div>
      </div>
    </section>
    <section className="insight-band"><div className="shell insight-grid"><div><span className="eyebrow">One finding. A different perspective.</span><h2>Frequent visits and long stays<br />aren’t always the same story.</h2></div><div className="big-insight"><strong>{pct(data.metrics.topTenBedDayShare)}</strong><span>of hospital days are used by the 10% of people with the most hospital time.</span></div></div></section>
    <section className="shell home-section"><div className="home-section-heading"><div><span className="eyebrow">Different patterns, different support</span><h2>Meet the people behind the demand.</h2></div><button className="text-button" onClick={() => setPage("explore")}>All four groups <ArrowRight size={18} /></button></div><BedDaysGloss />
      <div className="two-column">{featured.map(group => <Reveal key={group.id}><Card className={`${cardClass} featured-group`}><span className="featured-icon" style={{ color: group.color }}>{group.id === "acute" ? <HeartPulse size={24} /> : <RefreshCcw size={24} />}</span><h3>{group.name}</h3><p>{group.description}</p><div className="featured-numbers"><div><strong>{pct(group.patientShare, 1)}</strong><span>of people</span></div><div><strong>{pct(group.bedDayShare, 1)}</strong><span>of hospital days</span></div></div></Card></Reveal>)}</div>
    </section>
    <section className="shell home-chart-section"><div><span className="eyebrow">See the whole picture</span><h2>A small share of people.<br />A large share of hospital time.</h2><p>The curve shows how hospital days add up, from people with the shortest total time in hospital to those with the longest.</p><button className="text-button" onClick={() => setPage("evidence")}>Take a closer look <ArrowRight size={18} /></button></div><Panel title="Where hospital time adds up"><ConcentrationChart points={data.concentration} /></Panel></section>
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
  const [mode, setMode] = useState("guided");
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});
  const [downloadError, setDownloadError] = useState("");
  const assumptions = data.scenario_assumptions;
  const [eligible, setEligible] = useState(assumptions.eligible_pct);
  const [uptake, setUptake] = useState(assumptions.uptake_pct);
  const [days, setDays] = useState(assumptions.days_per_patient);
  const cohort = data.cohorts.find(c => c.id === cohortId) ?? data.cohorts[0];
  const result = useMemo(() => simulateScenario(cohort, eligible, uptake, days, assumptions.n_draws), [cohort, eligible, uptake, days, assumptions.n_draws]);
  const defaultPlan = eligible === assumptions.eligible_pct && uptake === assumptions.uptake_pct && days === assumptions.days_per_patient;
  return <div className="shell page scenario-page">
    <PageHeading kicker="Try a plan" title="Small changes. A range of possibilities.">Adjust your assumptions and compare 2,000 possible plans.</PageHeading>
    <div className="plan-toolbar"><div className="explore-view-switch" role="group" aria-label="Planning mode"><button aria-pressed={mode === "guided"} onClick={() => setMode("guided")}>Guided chat</button><button aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>Manual planning</button></div><button className="secondary" onClick={() => { setDownloadError(""); void downloadPlan(cohort, conversations[cohort.id] ?? [opening(cohort)], mode === "manual" ? `Checked for support: ${eligible}%; joining: ${uptake}%; assumed days saved: ${days}. Hospital days saved: middle ${nf.format(result.p50)}, lower ${nf.format(result.p10)}, upper ${nf.format(result.p90)}. Assumption-based simulation, not a forecast.` : undefined).catch(() => setDownloadError("The summary could not be downloaded. Please try again.")); }}>Download summary</button></div>
    {downloadError && <p role="alert">{downloadError}</p>}
    {mode === "guided" && <><div className="field-label"><label htmlFor="chat-group">Patient group</label><select id="chat-group" value={cohort.id} onChange={e => setCohortId(e.target.value)}>{data.cohorts.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></div><PlanningChat key={cohort.id} group={cohort} messages={conversations[cohort.id] ?? [opening(cohort)]} onMessages={messages => setConversations(current => ({ ...current, [cohort.id]: messages }))} /></>}
    {mode === "manual" && <div>
    <div className="scenario-layout">
      <Panel title="Your assumptions" eyebrow="You set the plan">
        <div className="field-label"><label htmlFor="scenario-group">Patient group</label><select id="scenario-group" value={cohort.id} onChange={e => setCohortId(e.target.value)}>{data.cohorts.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></div>
        <RangeControl label="Checked for extra support" value={eligible} setValue={setEligible} min={0} max={100} step={5} suffix="%" helper="Share suitable after a support check." />
        <RangeControl label="How many agree to join" value={uptake} setValue={setUptake} min={0} max={100} step={5} suffix="%" helper="Share of suitable people who join." />
        <RangeControl label="Hospital days saved per person" value={days} setValue={setDays} min={0} max={5} step={.25} suffix=" days" helper="Assumed benefit, not measured in the data." />
        <button className="text-button" onClick={() => { setEligible(assumptions.eligible_pct); setUptake(assumptions.uptake_pct); setDays(assumptions.days_per_patient); }}><RefreshCcw size={17} />Reset assumptions</button>
      </Panel>
      <Panel title="Possible hospital days saved" eyebrow="2,000 simulated plans" className="simulation-panel">
        <div aria-live="polite" aria-atomic="true" data-testid="simulation-result"><div className="simulation-main"><strong>{nf.format(result.p50)}</strong><span>middle estimate · hospital days</span></div><div className="range-results"><div><span>Lower estimate</span><strong>{nf.format(result.p10)}</strong><small>10th percentile</small></div><div><span>Upper estimate</span><strong>{nf.format(result.p90)}</strong><small>90th percentile</small></div></div><p className="range-explanation">Eight out of ten simulated plans fall between <strong>{nf.format(result.p10)}</strong> and <strong>{nf.format(result.p90)}</strong> days.</p><div className="detail-metric"><span>Average across all variations</span><strong>{nf.format(result.mean)} days</strong></div></div>
        <p className="scenario-limit">An assumption-based range, not a forecast. Capped at {nf.format(cohort.inpatientBedDays)} recorded hospital days.</p>
      </Panel>
    </div>
    <details className="scenario-notes"><summary>About hospital days and these assumptions</summary><BedDaysGloss /><p>The checked-for-support and joining rates vary around your percentages. Days saved vary around your chosen value; 0% or zero days always gives zero savings.</p><p>We use independent Beta distributions with concentration 40 for the two percentages, and a normal distribution with a standard deviation of 20% of the chosen days. Days cannot be negative; 0% and 100% stay fixed. A fixed random seed keeps repeated calculations steady. These ranges are chosen assumptions, not uncertainty measured from the records.</p>{defaultPlan && <p>The saved data-build example has a middle estimate of {nf.format(cohort.default_simulation.p50)} days. Browser samples can differ slightly.</p>}</details>
    </div>}
  </div>;
}

function Method({ data }: { data: Summary }) {
  const metrics = data.model_metrics;
  const agreement = data.cluster_validation.agreement_rate;
  return <div className="shell page">
    <PageHeading kicker="How this works" title="Clear evidence. Honest limits.">CarePath helps teams ask better planning questions. It never identifies or advises any single named patient — it only describes groups, for hospital planning.</PageHeading>
    <BedDaysGloss />
    <div className="two-column">
      <Panel title="How good is our admission model?" eyebrow="A check against held-out records"><p>{data.risk_factors.length ? `The strongest model factors were ${data.risk_factors.slice(0, 2).map(f => f.factor.toLowerCase()).join(" and ")}.` : "There is not enough variation to fit an admission model."} These are links in the same year’s records, not causes or predictions for someone’s next visit.</p><p>{metrics.accuracy !== null && metrics.baseline_accuracy !== null ? `Accuracy is ${pct(metrics.accuracy, 1)}, compared with ${pct(metrics.baseline_accuracy, 1)} for always guessing the most common outcome: ${Math.abs((metrics.accuracy - metrics.baseline_accuracy) * 100).toFixed(1)} percentage points ${metrics.accuracy >= metrics.baseline_accuracy ? "better" : "worse"}.` : "Model accuracy and its comparison with guessing are unavailable."}</p><p>Training records: {nf.format(metrics.train_size)}. Held-out test records: {nf.format(metrics.test_size)}.</p><RiskChart data={data} /><div className="model-metrics"><span>Test accuracy <strong>{metrics.accuracy === null ? "Unavailable" : pct(metrics.accuracy, 1)}</strong></span><span>AUC <strong>{metrics.auc?.toFixed(2) ?? "Unavailable"}</strong></span><span>Simple baseline <strong>{metrics.baseline_accuracy === null ? "Unavailable" : pct(metrics.baseline_accuracy, 1)}</strong></span></div><details><summary>What these checks mean</summary><p>The model learns from 80% of people ({nf.format(metrics.train_size)}) and is checked on the other 20% ({nf.format(metrics.test_size)}). Accuracy is the share classified correctly; the baseline always chooses the more common training outcome. AUC measures how well the model separates people with and without an admission (0.5 is chance; 1 is perfect).</p><p>Logistic regression uses numeric recorded age, ED visit count, age-group indicators and visit-frequency indicators. Scaling is fitted only to training data. Same-year visit counts and admissions are related by design; there is no future-year or external validation.</p></details></Panel>
      <Panel title="Do the four groups fit the data?" eyebrow="Independent clustering check"><p>{agreement === null ? "There are not enough distinct patterns for a four-way clustering check." : `An independent grouping method matched our four groups for ${agreement.toFixed(1)}% of people.`} This is a check of how closely the patterns agree, not proof that the groups are clinically correct.</p><ClusterChart data={data} /><details><summary>How the comparison works</summary><p>KMeans finds four patterns using ED visit count, total hospital days and numeric recorded age, each standardised to a common scale. It is independent of the group labels but uses the same records; a partial match is expected because the four original groups use two fixed cut-offs.</p></details></Panel>
    </div>
    <Panel title="Before this could be used with real data" className="section-gap"><ul className="validation-list"><li>Check admission-status and potentially avoidable GP-type flag definitions against the official WA Health data dictionary with a clinical lead.</li><li>Evaluate accuracy, AUC and calibration on a held-out real-data sample, including age and service subgroups, before relying on the model.</li><li>Agree which clinical and planning leads review the ranked support options, and how they document decisions and check local service capacity.</li><li>Run a fixed-duration pilot alongside one ward's existing intake process; compare workload, outcomes and unintended effects before wider rollout.</li></ul></Panel>
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
