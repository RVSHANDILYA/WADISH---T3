import { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  HeartPulse,
  Home,
  Info,
  Lightbulb,
  RefreshCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { BandSummary, Cohort, Summary } from "./types";

type Page = "overview" | "explore" | "scenario" | "method";

const nf = new Intl.NumberFormat("en-AU");
const compact = new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 });
const pct = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`;

const tourSteps = [
  {
    kicker: "Welcome to CarePath",
    title: "See the health system through a patient pathway, not a spreadsheet.",
    body: "We will guide you through one evidence-backed insight, the people behind it, and a transparent planning scenario.",
    icon: Compass,
  },
  {
    kicker: "Step 1 · Find the pressure",
    title: "Discover where inpatient demand is concentrated.",
    body: "The overview reveals how a small share of patients can account for a much larger share of bed-days.",
    icon: Activity,
  },
  {
    kicker: "Step 2 · Understand the people",
    title: "Separate recurrence from clinical complexity.",
    body: "Four plain-language cohorts prevent a one-size-fits-all response and make the evidence operational.",
    icon: Users,
  },
  {
    kicker: "Step 3 · Test, don’t promise",
    title: "Explore a scenario without pretending it is a causal forecast.",
    body: "Change eligibility, uptake and assumed bed-days. Every output remains traceable to your inputs.",
    icon: Lightbulb,
  },
];

function App() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("overview");
  const [tour, setTour] = useState(0);
  const [showTour, setShowTour] = useState(() => localStorage.getItem("carepath-tour") !== "done");
  const [a11y, setA11y] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [contrast, setContrast] = useState(false);

  useEffect(() => {
    fetch("/data/summary.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("The local analytical summary has not been prepared.");
        return response.json();
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const closeTour = () => {
    setShowTour(false);
    localStorage.setItem("carepath-tour", "done");
  };

  if (error) return <SetupScreen message={error} />;
  if (!data) return <LoadingScreen />;

  return (
    <div className={`${largeText ? "large-text" : ""} ${contrast ? "high-contrast" : ""}`}>
      <Header
        page={page}
        setPage={setPage}
        onGuide={() => { setTour(0); setShowTour(true); }}
        onAccessibility={() => setA11y(true)}
      />
      <main id="main-content">
        {page === "overview" && <Overview data={data} setPage={setPage} />}
        {page === "explore" && <Explore data={data} setPage={setPage} />}
        {page === "scenario" && <Scenario data={data} />}
        {page === "method" && <Method data={data} />}
      </main>
      <Footer />
      {showTour && <GuidedTour step={tour} setStep={setTour} onClose={closeTour} />}
      {a11y && (
        <AccessibilityPanel
          largeText={largeText}
          setLargeText={setLargeText}
          contrast={contrast}
          setContrast={setContrast}
          onClose={() => setA11y(false)}
        />
      )}
    </div>
  );
}

function Header({ page, setPage, onGuide, onAccessibility }: {
  page: Page; setPage: (page: Page) => void; onGuide: () => void; onAccessibility: () => void;
}) {
  const links: { id: Page; label: string; icon: typeof Home }[] = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "explore", label: "Cohorts", icon: Users },
    { id: "scenario", label: "Scenario lab", icon: Sparkles },
    { id: "method", label: "Trust centre", icon: ShieldCheck },
  ];
  return (
    <header className="site-header">
      <button className="brand" onClick={() => setPage("overview")} aria-label="CarePath home">
        <span className="brand-mark"><HeartPulse size={22} /></span>
        <span><strong>CarePath</strong><small>Pathway intelligence</small></span>
      </button>
      <nav aria-label="Primary navigation">
        {links.map(({ id, label, icon: Icon }) => (
          <button className={page === id ? "active" : ""} onClick={() => setPage(id)} key={id}>
            <Icon size={17} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <button className="icon-button" onClick={onAccessibility} aria-label="Accessibility settings"><Accessibility size={20} /></button>
        <button className="guide-button" onClick={onGuide}><CircleHelp size={18} /> Guide me</button>
      </div>
    </header>
  );
}

function Overview({ data, setPage }: { data: Summary; setPage: (page: Page) => void }) {
  const recurrent = data.cohorts.find((item) => item.id === "recurrent")!;
  const acute = data.cohorts.find((item) => item.id === "acute")!;
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> WA Health and Care Hackathon 2026</span>
          <h1>Find the care pathways hidden inside hospital demand.</h1>
          <p>CarePath turns linked emergency and inpatient records into clear cohorts, human stories and transparent planning scenarios for adults aged 65+.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setPage("explore")}>Explore the cohorts <ArrowRight size={19} /></button>
            <button className="secondary" onClick={() => setPage("method")}><ShieldCheck size={19} /> See how it works</button>
          </div>
          <p className="evidence-note"><ShieldCheck size={16} /> Synthetic 2022 data · Descriptive decision support · No individual clinical decisions</p>
        </div>
        <div className="hero-visual" aria-label="Care pathway visualisation">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="pulse-core"><HeartPulse size={40} /><strong>65+</strong><span>population</span></div>
          <div className="orbit-card card-ed"><Activity size={18} /><span>ED</span><strong>{compact.format(data.metrics.edPresentations)}</strong></div>
          <div className="orbit-card card-care"><Route size={18} /><span>Cohorts</span><strong>4</strong></div>
          <div className="orbit-card card-beds"><BarChart3 size={18} /><span>Bed-days</span><strong>{compact.format(data.metrics.inpatientBedDays)}</strong></div>
        </div>
      </section>

      <section className="insight-band">
        <div className="shell insight-grid">
          <div><span className="section-kicker">The signal</span><h2>Demand is concentrated—but recurrence tells only half the story.</h2></div>
          <div className="big-insight"><strong>{pct(data.metrics.topTenBedDayShare)}</strong><span>of bed-days sit within the highest-burden 10% of patients</span></div>
        </div>
      </section>

      <section className="shell section">
        <SectionHeading kicker="One population, two pressures" title="Different patterns need different pathways" body="CarePath keeps acute complexity separate from recurrent utilisation, so service responses can be targeted rather than generic." />
        <div className="story-grid">
          <StoryCard cohort={acute} icon={<HeartPulse />} headline={`${pct(acute.patientShare, 1)} of patients`} detail={`${pct(acute.bedDayShare, 1)} of inpatient bed-days`} />
          <div className="versus"><span>AND</span></div>
          <StoryCard cohort={recurrent} icon={<RefreshCcw />} headline={`${pct(recurrent.patientShare, 1)} of patients`} detail={`${pct(recurrent.bedDayShare, 1)} of inpatient bed-days`} />
        </div>
      </section>

      <section className="shell section chart-section">
        <div className="chart-copy">
          <SectionHeading kicker="Resource concentration" title="Averages hide the pressure point" body="Move from left to right: most patients accumulate relatively few bed-days, then the curve rises sharply among a small high-burden group." />
          <div className="reading-key"><span>How to read this</span><p>The farther the teal curve bends below the dotted equality line, the more concentrated the resource burden.</p></div>
        </div>
        <ConcentrationChart points={data.concentration} />
      </section>

      <section className="shell section">
        <SectionHeading kicker="The journey" title="From raw records to an action-ready conversation" />
        <div className="steps-row">
          {[
            ["01", "Detect", "Reveal concentration and non-linear patterns."],
            ["02", "Understand", "Compare age, recurrence and inpatient burden."],
            ["03", "Prioritise", "Choose cohorts for pathway review."],
            ["04", "Test", "Make assumptions visible in a scenario."],
          ].map(([number, title, body]) => <div className="step-card" key={number}><span>{number}</span><strong>{title}</strong><p>{body}</p></div>)}
        </div>
      </section>
    </>
  );
}

function Explore({ data, setPage }: { data: Summary; setPage: (page: Page) => void }) {
  const [selectedId, setSelectedId] = useState("recurrent");
  const cohort = data.cohorts.find((item) => item.id === selectedId)!;
  return (
    <div className="shell page">
      <SectionHeading kicker="Cohort explorer" title="Meet the patterns behind the numbers" body="Choose a cohort. CarePath explains its scale, observed utilisation and the services worth reviewing—without prescribing treatment." />
      <div className="cohort-tabs" role="tablist" aria-label="Patient cohorts">
        {data.cohorts.map((item) => (
          <button key={item.id} role="tab" aria-selected={selectedId === item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)} style={{ "--cohort": item.color } as React.CSSProperties}>
            <span className="cohort-dot" /><strong>{item.name}</strong><small>{item.label}</small>
          </button>
        ))}
      </div>

      <div className="cohort-hero" style={{ "--cohort": cohort.color } as React.CSSProperties}>
        <div><span className="pill">{cohort.label}</span><h2>{cohort.name}</h2><p>{cohort.description}</p></div>
        <div className="cohort-number"><strong>{nf.format(cohort.patients)}</strong><span>people · {pct(cohort.patientShare, 1)} of the population</span></div>
      </div>

      <div className="metric-grid">
        <MetricCard label="ED presentations" value={nf.format(cohort.edPresentations)} helper={`${cohort.medianPresentations} median per person`} />
        <MetricCard label="Experienced admission" value={pct(cohort.admissionShare, 1)} helper="At least one admission disposition" />
        <MetricCard label="Inpatient bed-days" value={nf.format(Math.round(cohort.inpatientBedDays))} helper={`${pct(cohort.bedDayShare, 1)} of all bed-days`} />
        <MetricCard label="Median age band" value={`${cohort.medianAgeBand}–${cohort.medianAgeBand + 4}`} helper="Age is supplied in five-year bands" />
      </div>

      <div className="explore-grid">
        <div className="panel">
          <PanelTitle icon={<Route />} title="Observed pathway pattern" subtitle="A service-level view, not an individual prediction" />
          <PathwayFlow cohort={cohort} />
        </div>
        <div className="panel pathway-panel">
          <PanelTitle icon={<Lightbulb />} title="Pathway review prompts" subtitle="Services to assess, not automated recommendations" />
          <ol className="prompt-list">
            {cohort.pathwayPrompts.map((prompt, index) => <li key={prompt}><span>{index + 1}</span>{prompt}</li>)}
          </ol>
          <button className="primary full" onClick={() => setPage("scenario")}>Test this cohort in Scenario Lab <ArrowRight size={18} /></button>
        </div>
      </div>

      <div className="panel frequency-panel">
        <PanelTitle icon={<BarChart3 />} title="How repeat presentation relates to admission" subtitle="Share of patients with at least one admission disposition during 2022" />
        <FrequencyChart bands={data.frequency} />
      </div>
    </div>
  );
}

function Scenario({ data }: { data: Summary }) {
  const candidates = data.cohorts.filter((item) => item.id === "recurrent" || item.id === "acute");
  const [cohortId, setCohortId] = useState("recurrent");
  const [eligible, setEligible] = useState(20);
  const [uptake, setUptake] = useState(60);
  const [days, setDays] = useState(1.5);
  const cohort = candidates.find((item) => item.id === cohortId)!;
  const reviewed = Math.round(cohort.patients * eligible / 100);
  const participating = Math.round(reviewed * uptake / 100);
  const released = Math.round(participating * days);
  const share = cohort.inpatientBedDays ? released / cohort.inpatientBedDays : 0;
  return (
    <div className="shell page">
      <SectionHeading kicker="Scenario lab" title="Make every assumption visible" body="This is a transparent service-planning sandbox. It helps teams ask better questions; it does not estimate a treatment effect." />
      <div className="scenario-layout">
        <section className="scenario-controls panel">
          <label className="field-label">Target cohort<select value={cohortId} onChange={(event) => setCohortId(event.target.value)}>{candidates.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <RangeControl label="Assessed as pathway-eligible" value={eligible} setValue={setEligible} min={0} max={50} step={5} suffix="%" helper="Share of this cohort receiving an eligibility assessment" />
          <RangeControl label="Eligible patients taking up the pathway" value={uptake} setValue={setUptake} min={0} max={100} step={5} suffix="%" helper="Assumed service uptake among eligible patients" />
          <RangeControl label="Bed-days avoided per participating patient" value={days} setValue={setDays} min={0} max={5} step={0.25} suffix=" days" helper="A user-supplied assumption—not inferred from the dataset" />
          <button className="text-button" onClick={() => { setEligible(20); setUptake(60); setDays(1.5); }}><RefreshCcw size={16} /> Reset assumptions</button>
        </section>
        <section className="scenario-result">
          <span className="eyebrow"><Sparkles size={15} /> Live planning estimate</span>
          <h2>{nf.format(released)} <small>bed-days</small></h2>
          <p>placed into an illustrative annual capacity opportunity</p>
          <div className="scenario-ring" style={{ "--progress": `${Math.min(100, share * 100)}%` } as React.CSSProperties}><div><strong>{pct(share, 1)}</strong><span>of this cohort’s observed bed-days</span></div></div>
          <div className="scenario-mini-grid"><div><strong>{nf.format(reviewed)}</strong><span>reviewed</span></div><div><strong>{nf.format(participating)}</strong><span>participating</span></div><div><strong>{days}</strong><span>days each</span></div></div>
        </section>
      </div>
      <div className="assumption-banner"><Info size={21} /><div><strong>Interpretation boundary</strong><p>{nf.format(released)} is simple scenario arithmetic: {nf.format(cohort.patients)} patients × {eligible}% eligible × {uptake}% uptake × {days} days. It is not a prediction or causal claim.</p></div></div>
    </div>
  );
}

function Method({ data }: { data: Summary }) {
  return (
    <div className="shell page trust-page">
      <SectionHeading kicker="Trust centre" title="Built to be challenged, checked and improved" body="Every important definition and limitation is visible. CarePath prioritises responsible interpretation over false precision." />
      <div className="trust-grid">
        <article className="trust-card"><span><ShieldCheck /></span><h3>Protected by design</h3><p>Raw EDDC and HMDC files remain local and are excluded from Git. The browser receives only an authorised analytical summary.</p></article>
        <article className="trust-card"><span><BookOpenCheck /></span><h3>Definitions first</h3><p>Frequent presentation means four or more ED presentations. High burden means at least {data.metrics.highBurdenThreshold} same-year inpatient bed-days—the observed 90th percentile.</p></article>
        <article className="trust-card"><span><Activity /></span><h3>Person-year linkage</h3><p>ED and inpatient records are aggregated at linked person-year level. We do not claim a particular ED event caused a particular inpatient episode.</p></article>
        <article className="trust-card"><span><Users /></span><h3>Human decision support</h3><p>Pathway prompts identify services worth assessing. They do not diagnose, prescribe, approve or deny care.</p></article>
      </div>
      <div className="method-table panel">
        <h2>Evidence card</h2>
        <dl>
          <div><dt>Population</dt><dd>{data.population}</dd></div>
          <div><dt>Time window</dt><dd>1 January to 31 December 2022</dd></div>
          <div><dt>Age representation</dt><dd>Five-year bands; no exact ages are inferred</dd></div>
          <div><dt>Resource measure</dt><dd>Sum of same-year HMDC episode duration per linked person</dd></div>
          <div><dt>Primary use</dt><dd>Service planning and alternative-pathway review prioritisation</dd></div>
          <div><dt>Not suitable for</dt><dd>Individual clinical decisions, causal claims or prospective operational forecasts</dd></div>
        </dl>
      </div>
    </div>
  );
}

function StoryCard({ cohort, icon, headline, detail }: { cohort: Cohort; icon: React.ReactNode; headline: string; detail: string }) {
  return <article className="story-card" style={{ "--cohort": cohort.color } as React.CSSProperties}><div className="story-icon">{icon}</div><span>{cohort.label}</span><h3>{cohort.name}</h3><strong>{headline}</strong><p>{detail}</p><small>{cohort.description}</small></article>;
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}

function SectionHeading({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return <header className="section-heading"><span className="section-kicker">{kicker}</span><h2>{title}</h2>{body && <p>{body}</p>}</header>;
}

function PanelTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return <div className="panel-title"><span>{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div>;
}

function PathwayFlow({ cohort }: { cohort: Cohort }) {
  const admitted = Math.round(cohort.edAdmissions / cohort.edPresentations * 100);
  return <div className="path-flow"><div className="flow-node"><Activity /><strong>ED presentation</strong><span>{nf.format(cohort.edPresentations)} events</span></div><ArrowRight /><div className="flow-split"><div><strong>{admitted}%</strong><span>admission dispositions</span></div><div><strong>{100 - admitted}%</strong><span>other departures</span></div></div><ArrowRight /><div className="flow-node accent"><Route /><strong>Pathway review</strong><span>{cohort.label}</span></div></div>;
}

function ConcentrationChart({ points }: { points: Summary["concentration"] }) {
  const width = 640, height = 360, pad = 44;
  const x = (value: number) => pad + value * (width - pad * 2);
  const y = (value: number) => height - pad - value * (height - pad * 2);
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.patientShare)},${y(point.bedDayShare)}`).join(" ");
  const area = `${path} L${x(1)},${y(0)} L${x(0)},${y(0)} Z`;
  return <div className="chart-card"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cumulative patient share compared with cumulative inpatient bed-day share"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#14b8a6" stopOpacity=".32"/><stop offset="1" stopColor="#14b8a6" stopOpacity=".03"/></linearGradient></defs>{[0,.25,.5,.75,1].map((v) => <g key={v}><line x1={pad} x2={width-pad} y1={y(v)} y2={y(v)} className="grid-line"/><text x={pad-10} y={y(v)+4} textAnchor="end">{v*100}%</text><text x={x(v)} y={height-14} textAnchor="middle">{v*100}%</text></g>)}<line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className="equality"/><path d={area} fill="url(#area)"/><path d={path} className="curve"/><text x={width/2} y={height-1} textAnchor="middle" className="axis-label">Cumulative share of patients</text><text transform={`translate(13 ${height/2}) rotate(-90)`} textAnchor="middle" className="axis-label">Cumulative share of bed-days</text></svg><div className="chart-legend"><span><i className="teal" />Observed concentration</span><span><i className="dash" />Equal distribution</span></div></div>;
}

function FrequencyChart({ bands }: { bands: BandSummary[] }) {
  const max = Math.max(...bands.map((item) => item.admissionShare));
  return <div className="bar-chart" role="img" aria-label="Admission share by ED presentation frequency">{bands.map((item) => <div className="bar-column" key={item.label}><div className="bar-value">{pct(item.admissionShare)}</div><div className="bar-track"><div className="bar-fill" style={{ height: `${item.admissionShare / max * 100}%` }} /></div><strong>{item.label}</strong><span>visits</span></div>)}</div>;
}

function RangeControl({ label, value, setValue, min, max, step, suffix, helper }: { label: string; value: number; setValue: (n: number) => void; min: number; max: number; step: number; suffix: string; helper: string }) {
  return <label className="range-control"><div><strong>{label}</strong><output>{value}{suffix}</output></div><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => setValue(Number(event.target.value))}/><small>{helper}</small></label>;
}

function GuidedTour({ step, setStep, onClose }: { step: number; setStep: (step: number) => void; onClose: () => void }) {
  const item = tourSteps[step], Icon = item.icon;
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tour-title"><div className="tour-modal"><button className="modal-close" onClick={onClose} aria-label="Close guided tour"><X /></button><div className="tour-art"><div className="tour-orbit"/><span><Icon size={42}/></span></div><div className="tour-content"><small>{item.kicker}</small><h2 id="tour-title">{item.title}</h2><p>{item.body}</p><div className="tour-progress" aria-label={`Step ${step+1} of ${tourSteps.length}`}>{tourSteps.map((_, index) => <i className={index <= step ? "done" : ""} key={index}/>)}</div><div className="tour-actions"><button className="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}><ChevronLeft /> Back</button>{step < tourSteps.length - 1 ? <button className="primary" onClick={() => setStep(step + 1)}>Next <ChevronRight /></button> : <button className="primary" onClick={onClose}><Check /> Start exploring</button>}</div></div></div></div>;
}

function AccessibilityPanel({ largeText, setLargeText, contrast, setContrast, onClose }: { largeText: boolean; setLargeText: (v: boolean) => void; contrast: boolean; setContrast: (v: boolean) => void; onClose: () => void }) {
  return <div className="modal-backdrop align-right" role="dialog" aria-modal="true" aria-label="Accessibility settings"><div className="access-panel"><button className="modal-close" onClick={onClose}><X /></button><Accessibility size={28}/><h2>Make CarePath comfortable</h2><p>These settings apply immediately.</p><label className="toggle-row"><span><strong>Larger text</strong><small>Increase labels and body copy</small></span><input type="checkbox" checked={largeText} onChange={(e) => setLargeText(e.target.checked)} /></label><label className="toggle-row"><span><strong>High contrast</strong><small>Strengthen borders and text contrast</small></span><input type="checkbox" checked={contrast} onChange={(e) => setContrast(e.target.checked)} /></label><button className="primary full" onClick={onClose}>Done</button></div></div>;
}

function LoadingScreen() { return <div className="state-screen"><div className="loader"><HeartPulse /></div><h1>Preparing CarePath</h1><p>Turning linked records into a clear patient-pathway story…</p></div>; }
function SetupScreen({ message }: { message: string }) { return <div className="state-screen setup"><div className="setup-icon"><Info /></div><h1>One local preparation step remains</h1><p>{message}</p><code>python scripts/build_summary.py</code><code>npm run dev</code><small>The raw files stay on your computer and are never bundled into the website source.</small></div>; }
function Footer() { return <footer><div className="shell"><div><strong>CarePath</strong><span>Built for WA Health and Care Hackathon 2026 · Challenge 2B</span></div><p>Synthetic data · Decision support only · Not clinical advice</p></div></footer>; }

export default App;
