import { useMemo, useState } from "react";
import { BarChart, Card } from "@tremor/react";
import { Check, Info, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { ExplorationCell, Summary } from "../types";

const metrics = [
  { key: "patients", label: "People" },
  { key: "edPresentations", label: "ED visits" },
  { key: "inpatientBedDays", label: "Hospital days" },
] as const;
const rateMetrics = [
  { key: "median_bed_days_per_person", label: "Typical days per person" },
  { key: "ed_presentations_per_person", label: "ED visits per person (mean)" },
  { key: "admissions_per_100_presentations", label: "Admissions per 100 presentations" },
] as const;
type RateMetric = typeof rateMetrics[number]["key"];
const rateNumber = (value: number | null | undefined) => value == null ? "No people" : value.toLocaleString("en-AU", { maximumFractionDigits: 2 });
type Metric = typeof metrics[number]["key"];
const number = (value: number) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(value);
const cellId = (cell: ExplorationCell) => `${cell.ageGroup}|${cell.frequencyBand}`;
const cardClass = "border border-slate-100 shadow-sm rounded-xl panel";

export function EvidenceExplorer({ data }: { data: Summary }) {
  const [metric, setMetric] = useState<Metric>("patients");
  const [measure, setMeasure] = useState<"totals" | "rates">("totals");
  const [rateMetric, setRateMetric] = useState<RateMetric>("median_bed_days_per_person");
  const [selection, setSelection] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "charts">("grid");
  const ages = data.age.map(row => row.label);
  const frequencies = data.frequency.map(row => row.label);
  const activeMetric = measure === "totals" ? metric : rateMetric;
  const activeLabel = [...metrics, ...rateMetrics].find(item => item.key === activeMetric)!.label;
  const maximum = Math.max(1, ...data.exploration.map(cell => cell[activeMetric] ?? 0));
  const chosen = useMemo(() => selection.length ? data.exploration.filter(cell => selection.includes(cellId(cell))) : data.exploration, [selection, data.exploration]);
  const total = (field: Metric | "edAdmissions" | "potentiallyAvoidable") => chosen.reduce((sum, cell) => sum + cell[field], 0);
  const patients = total("patients"), visits = total("edPresentations"), days = total("inpatientBedDays");
  const toggle = (id: string) => setSelection(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const ageChart = ages.map(age => ({ age, "Hospital days": chosen.filter(c => c.ageGroup === age).reduce((sum, c) => sum + c.inpatientBedDays, 0) }));
  const frequencyChart = frequencies.map(frequency => {
    const rows = chosen.filter(c => c.frequencyBand === frequency);
    const presentations = rows.reduce((sum, c) => sum + c.edPresentations, 0);
    return { frequency, "Visits ending in admission": presentations ? rows.reduce((sum, c) => sum + c.edAdmissions, 0) / presentations * 100 : 0 };
  });
  return <div className="shell page evidence-page">
    <div className="page-heading"><span className="eyebrow">Explore the evidence</span><h1>A closer look. <span className="teal-text">A clearer picture.</span></h1><p>Select age and visit groups, then switch to charts to compare them.</p></div>
    <div className="explore-view-switch" role="group" aria-label="Explore view"><button aria-pressed={view === "grid"} onClick={() => setView("grid")}>Select groups</button><button aria-pressed={view === "charts"} onClick={() => setView("charts")}>Compare charts</button><span>Your selection stays with you.</span></div>
    <div className="evidence-layout">
      <div className="evidence-workspace">
      {view === "grid" ? (<Card className={cardClass}>
        <div className="evidence-card-heading"><div><h2>Age meets visit frequency</h2><p>{measure === "totals" ? "Totals: where the burden falls" : "Rates: compare use per person and per presentation"}</p></div><SlidersHorizontal size={21} /></div>
        <div className="explore-view-switch" role="group" aria-label="Grid measure"><button aria-pressed={measure === "totals"} onClick={() => setMeasure("totals")}>Totals</button><button aria-pressed={measure === "rates"} onClick={() => setMeasure("rates")}>Per-person rates</button></div>
        {measure === "rates" && <p className="caption">Median is used because a small number of very long stays would otherwise pull the average up for everyone in this group.</p>}
        {measure === "totals" ? <div className="metric-switch" role="group" aria-label="Shade the grid by">{metrics.map(item => <button key={item.key} aria-pressed={metric === item.key} onClick={() => setMetric(item.key)}>{item.label}</button>)}</div> : <div className="metric-switch" role="group" aria-label="Shade the grid by rate">{rateMetrics.map(item => <button key={item.key} aria-pressed={rateMetric === item.key} onClick={() => setRateMetric(item.key)}>{item.label}</button>)}</div>}
        <div className="table-scroll heatmap-scroll" tabIndex={0} role="region" aria-label="Age and ED visit grid, scroll horizontally on small screens">
          <table className="evidence-heatmap"><caption className="sr-only">Select age and visit-frequency combinations. Each cell shows {activeLabel.toLowerCase()}.</caption><thead><tr><th scope="col">Age</th>{frequencies.map(f => <th scope="col" key={f}>{f}<span>visits</span></th>)}</tr></thead>
            <tbody>{ages.map(age => <tr key={age}><th scope="row">{age}</th>{frequencies.map(frequency => {
              const cell = data.exploration.find(c => c.ageGroup === age && c.frequencyBand === frequency);
              const value = cell?.[activeMetric] ?? null, id = `${age}|${frequency}`, selected = selection.includes(id);
              const intensity = Math.sqrt((value ?? 0) / maximum);
              const tone = intensity > .75 ? "deep" : intensity > .5 ? "medium" : intensity > .25 ? "soft" : "pale";
              return <td key={frequency}><button disabled={!cell || cell.patients === 0} className={`heat-cell ${tone} ${selected ? "chosen" : ""}`} aria-pressed={selected} aria-label={`Age ${age}, ${frequency} visits, ${measure === "totals" ? number(value ?? 0) : rateNumber(value)} ${activeLabel.toLowerCase()}${measure === "rates" && rateMetric === "median_bed_days_per_person" ? `, mean ${rateNumber(cell?.mean_bed_days_per_person)} days per person` : ""}`} onClick={() => toggle(id)}>{selected && <Check size={15} aria-hidden="true" />}<span>{measure === "totals" ? number(value ?? 0) : rateNumber(value)}</span>{measure === "rates" && rateMetric === "median_bed_days_per_person" && cell && cell.patients > 0 && <small className="cell-mean">Mean {rateNumber(cell.mean_bed_days_per_person)}</small>}</button></td>;
            })}</tr>)}</tbody>
          </table>
        </div>
        <div className="heatmap-key"><span>Fewer</span><i className="pale" /><i className="soft" /><i className="medium" /><i className="deep" /><span>More</span><button className="text-button" onClick={() => setSelection([])} disabled={!selection.length}><RotateCcw size={16} />Clear selection</button></div>
        <details className="evidence-notes"><summary>How to read this grid</summary><p>Each person appears once, using their highest recorded age band and total ED visits in 2022. Selecting several cells adds their totals in the side panel. Rates are calculated separately within each cell; cell medians are never added or averaged. Hospital days include zero-day patients. Empty cells have no rate.</p></details>
      </Card>) : (<div className="two-column">
      <Card className={cardClass}><span className="eyebrow">{selection.length ? "Your selection" : "All people"} · Age</span><h2>Where hospital time adds up</h2><BarChart className="explore-chart" data={ageChart} index="age" categories={["Hospital days"]} colors={["teal"]} valueFormatter={number} yAxisWidth={75} showAnimation={false} /><details><summary>Read chart values</summary><ul className="chart-values">{ageChart.map(row => <li key={row.age}>{row.age}: {number(row["Hospital days"])} days</li>)}</ul></details></Card>
      <Card className={cardClass}><span className="eyebrow">{selection.length ? "Your selection" : "All people"} · Repeat visits</span><h2>ED visits ending in admission</h2><BarChart className="explore-chart" data={frequencyChart} index="frequency" categories={["Visits ending in admission"]} colors={["teal"]} valueFormatter={v => `${v.toFixed(1)}%`} minValue={0} maxValue={100} yAxisWidth={60} showAnimation={false} /><details><summary>Read chart values</summary><ul className="chart-values">{frequencyChart.map(row => <li key={row.frequency}>{row.frequency} visits: {row["Visits ending in admission"].toFixed(1)}%</li>)}</ul></details></Card>
    </div>)}
      </div>
      <Card className={`${cardClass} evidence-readout`} aria-live="polite" aria-atomic="true">
        <span className="eyebrow">{selection.length ? `${selection.length} cells selected` : "The whole picture"}</span><h2>{selection.length ? "Your selection" : "Everyone aged 65+"}</h2>
        {[{ label: "People", value: patients, all: data.metrics.patients }, { label: "ED visits", value: visits, all: data.metrics.edPresentations }, { label: "Hospital days", value: days, all: data.metrics.inpatientBedDays }].map(item => <div className="selection-stat" key={item.label}><span>{item.label}</span><strong>{number(item.value)}</strong><small>{item.all ? (item.value / item.all * 100).toFixed(1) : "0.0"}% of the total</small><div className="selection-track"><i style={{ width: `${item.all ? Math.min(100, item.value / item.all * 100) : 0}%` }} /></div></div>)}
        <p className="selection-admission"><strong>{visits ? (total("edAdmissions") / visits * 100).toFixed(1) : "0.0"}%</strong> of these ED visits have an admission recorded.</p>
      </Card>
    </div>
    <p className="gloss"><Info size={18} /><span>Hospital days (bed-days) are total time admitted, measured in days. One person staying three days uses three bed-days.</span></p>
    <p className="caption evidence-footnote">Both charts follow your selection. Empty categories show zero. These are group patterns, not advice for an individual patient.</p>
  </div>;
}
