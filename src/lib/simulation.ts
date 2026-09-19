import type { Cohort, Simulation } from "../types";

// Same assumptions as Python: Beta(mean * 40, (1-mean) * 40), independent
// uptake/eligibility, Normal(days, days * .2) clipped at zero, observed-day cap.
// Seeded Monte Carlo keeps repeat renders steady. RNG streams differ from NumPy,
// so precomputed and browser percentiles agree statistically, not bit for bit.
export function simulateScenario(
  group: Pick<Cohort, "patients" | "inpatientBedDays">,
  eligiblePct: number, uptakePct: number, daysPerPatient: number, nDraws = 2000,
): Simulation {
  if (![group.patients, group.inpatientBedDays, eligiblePct, uptakePct, daysPerPatient].every(Number.isFinite)
    || group.patients < 0 || group.inpatientBedDays < 0 || eligiblePct < 0 || eligiblePct > 100
    || uptakePct < 0 || uptakePct > 100 || daysPerPatient < 0 || !Number.isInteger(nDraws) || nDraws < 1) {
    throw new Error("Use non-negative values, percentages 0–100 and a positive draw count.");
  }
  let seed = 42;
  const uniform = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return (seed + .5) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
  // Marsaglia-Tsang gamma sampler, including the shape < 1 transformation.
  const gamma = (shape: number): number => {
    if (shape < 1) return gamma(shape + 1) * Math.pow(uniform(), 1 / shape);
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    while (true) {
      const x = normal(), base = 1 + c * x;
      if (base <= 0) continue;
      const v = base ** 3, u = uniform();
      if (u < 1 - .0331 * x ** 4 || Math.log(u) < .5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const beta = (pct: number) => {
    if (pct === 0 || pct === 100) return pct / 100;
    const a = gamma(pct / 100 * 40), b = gamma((1 - pct / 100) * 40);
    return a / (a + b);
  };
  const draws = Array.from({ length: nDraws }, () => {
    const eligible = beta(eligiblePct), uptake = beta(uptakePct);
    const days = Math.max(0, daysPerPatient + normal() * daysPerPatient * .2);
    return Math.min(group.inpatientBedDays, group.patients * eligible * uptake * days);
  }).sort((a, b) => a - b);
  const quantile = (q: number) => {
    const i = (draws.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return draws[lo] + (draws[hi] - draws[lo]) * (i - lo);
  };
  return { p10: quantile(.1), p50: quantile(.5), p90: quantile(.9), mean: draws.reduce((a, b) => a + b, 0) / nDraws };
}
