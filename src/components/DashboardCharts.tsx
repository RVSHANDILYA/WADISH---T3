import { AreaChart, BarChart as TremorBarChart } from "@tremor/react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./ui/chart";
import type { BandSummary, Summary } from "../types";

export function ConcentrationChart({ points }: { points: Summary["concentration"] }) {
  const rows = points.map(p => ({ people: `${Math.round(p.patientShare * 100)}%`,
    "Hospital days": p.bedDayShare * 100, "Evenly shared": p.patientShare * 100 }));
  return <div aria-label="Cumulative share of hospital days by share of people">
    <AreaChart className="h-80" data={rows} index="people" categories={["Hospital days", "Evenly shared"]}
      colors={["teal", "slate"]} minValue={0} maxValue={100} valueFormatter={v => `${Math.round(v)}%`}
      showAnimation={false} curveType="linear" yAxisWidth={55} xAxisLabel="People, from fewest to most hospital days" />
    <p className="caption">The teal curve shows recorded hospital days. The grey line shows what equal use would look like.</p>
    <details><summary>Read the chart as numbers</summary><div className="table-scroll"><table><thead><tr><th>Share of people</th><th>Share of hospital days</th></tr></thead><tbody>{points.filter((_, i) => i % 20 === 0 || i === points.length - 1).map((p, i) => <tr key={i}><td>{(p.patientShare * 100).toFixed(1)}%</td><td>{(p.bedDayShare * 100).toFixed(1)}%</td></tr>)}</tbody></table></div></details>
  </div>;
}

export function FrequencyChart({ bands }: { bands: BandSummary[] }) {
  return <div aria-label="Share of people admitted at least once by number of ED visits">
    <TremorBarChart className="h-72" data={bands.map(b => ({ visits: b.label, "Admitted at least once": b.admissionShare * 100 }))}
      index="visits" categories={["Admitted at least once"]} colors={["teal"]} minValue={0} maxValue={100}
      valueFormatter={v => `${Math.round(v)}%`} showAnimation={false} yAxisWidth={55} xAxisLabel="ED visits during the year" />
    <div className="chart-values">{bands.map(b => <span key={b.label}>{b.label} visits: <strong>{(b.admissionShare * 100).toFixed(1)}%</strong></span>)}</div>
  </div>;
}

const riskConfig = { importance: { label: "Relative weight (%)", color: "#0f766e" } } satisfies ChartConfig;
export function RiskChart({ data }: { data: Summary }) {
  if (!data.risk_factors.length) return <p>{data.model_metrics.reason}</p>;
  const rows = data.risk_factors.map((f, i) => ({ ...f, rank: String(i + 1), importance: f.importance * 100 }));
  return <>
    <p className="caption">Across all four groups, these factors had the largest model weights. They describe same-year patterns, not a person’s future risk.</p>
    <ChartContainer config={riskConfig} className="h-64 w-full aspect-auto" aria-label="Five strongest admission model factors">
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 0, right: 24 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="rank" width={30} axisLine={false} tickLine={false} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.factor} />} />
        <Bar dataKey="importance" fill="var(--color-importance)" radius={[0, 5, 5, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
    <ol className="factor-list">{rows.map(f => <li key={f.factor}><span>{f.factor}</span><strong>{f.importance.toFixed(1)}%</strong><span className="direction">{f.direction === "neutral" ? "No direction" : `${f.direction === "higher" ? "Higher" : "Lower"} admission association`}</span></li>)}</ol>
    <p className="caption">Weights are shares of all absolute, standardised model coefficients; only the top five are shown. Age and visit categories overlap, so these are not separate causes or increases in risk.</p>
  </>;
}

export function ClusterChart({ data }: { data: Summary }) {
  const validation = data.cluster_validation;
  if (validation.status !== "fitted") return <p>{validation.reason}</p>;
  const config: ChartConfig = Object.fromEntries(data.cohorts.map(c => [c.id, { label: c.name, color: c.color }]));
  const rows = validation.clusters.map(c => ({ cluster: `Pattern ${c.cluster}`,
    ...Object.fromEntries(data.cohorts.map(g => [g.id, c.group_counts[g.name] ?? 0])) }));
  return <>
    <ChartContainer config={config} className="h-80 w-full aspect-auto" aria-label="Patient groups within each independently found pattern">
      <BarChart accessibilityLayer data={rows} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} /><XAxis dataKey="cluster" axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => new Intl.NumberFormat("en-AU", { notation: "compact" }).format(v)} axisLine={false} tickLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {data.cohorts.map(g => <Bar key={g.id} dataKey={g.id} stackId="groups" fill={`var(--color-${g.id})`} isAnimationActive={false} />)}
      </BarChart>
    </ChartContainer>
    <div className="chart-values">{data.cohorts.map(g => <span key={g.id}><i style={{ background: g.color }} />{g.name}</span>)}</div>
    <div className="table-scroll"><table><caption>Average values at the centre of each pattern</caption><thead><tr><th>Pattern</th><th>People</th><th>ED visits / year</th><th>Hospital days / year</th><th>Recorded age*</th><th>Matched group</th></tr></thead><tbody>{validation.clusters.map(c => <tr key={c.cluster}><th>{c.cluster}</th><td>{c.size.toLocaleString("en-AU")}</td><td>{c.center.ed_presentations.toFixed(1)}</td><td>{c.center.hospital_days.toFixed(1)}</td><td>{c.center.age.toFixed(1)}</td><td>{c.matched_group}</td></tr>)}</tbody></table></div>
    <p className="caption">*Age centres average the supplied age-band lower bounds, not exact ages. Groups are matched one-to-one to the four patterns for the highest overall agreement.</p>
    <details><summary>See the full pattern-to-group comparison</summary><div className="table-scroll"><table><thead><tr><th>Pattern</th>{data.cohorts.map(g => <th key={g.id}>{g.name}</th>)}</tr></thead><tbody>{validation.clusters.map(c => <tr key={c.cluster}><th>{c.cluster}</th>{data.cohorts.map(g => <td key={g.id}>{c.group_counts[g.name] ?? 0}</td>)}</tr>)}</tbody></table></div></details>
  </>;
}
