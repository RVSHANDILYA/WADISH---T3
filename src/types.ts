export type Cohort = {
  id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  patients: number;
  patientShare: number;
  edPresentations: number;
  edAdmissions: number;
  admissionShare: number;
  inpatientBedDays: number;
  bedDayShare: number;
  medianBedDays: number;
  medianAgeBand: number;
  medianPresentations: number;
  potentiallyAvoidable: number;
  pathwayPrompts: string[];
  avoidable_share: number;
  recommended_interventions: { name: string; score: number; reason: string }[];
  default_simulation: Simulation;
};

export type Simulation = { p10: number; p50: number; p90: number; mean: number };
export type RiskFactor = { factor: string; importance: number; direction: "higher" | "lower" | "neutral" };
export type Cluster = {
  cluster: number;
  size: number;
  matched_group: string;
  center: { ed_presentations: number; hospital_days: number; age: number };
  group_counts: Record<string, number>;
};

export type BandSummary = {
  label: string;
  patients: number;
  patientShare: number;
  admissionShare: number;
  admissionRatePerPresentation: number;
  inpatientBedDays: number;
};

export type Summary = {
  schemaVersion: 2;
  generatedAt: string;
  population: string;
  metrics: {
    patients: number;
    edPresentations: number;
    edAdmissions: number;
    inpatientBedDays: number;
    topTenBedDayShare: number;
    highBurdenThreshold: number;
  };
  cohorts: Cohort[];
  frequency: BandSummary[];
  age: BandSummary[];
  concentration: { patientShare: number; bedDayShare: number }[];
  risk_factors: RiskFactor[];
  model_metrics: {
    status: "fitted" | "unavailable";
    accuracy: number | null;
    auc: number | null;
    baseline_accuracy: number | null;
    train_size: number;
    test_size: number;
    reason: string | null;
  };
  cluster_validation: {
    status: "fitted" | "unavailable";
    agreement_rate: number | null;
    clusters: Cluster[];
    reason: string | null;
  };
  scenario_assumptions: {
    eligible_pct: number;
    uptake_pct: number;
    days_per_patient: number;
    n_draws: number;
    beta_concentration: number;
    days_relative_sd: number;
  };
};
