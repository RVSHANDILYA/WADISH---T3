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
};
