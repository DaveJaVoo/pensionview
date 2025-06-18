
export interface PensionDataRow {
  [key: string]: string | number | undefined;
  Age: number;
  Year: string;
  'Initial DC Pension': number;
  'DC Pension Growth': number;
  'DC Pension + Growth': number;
  'DC AMC Charge': number;
  'DC Minus AMC': number;
  'DC UFPLS Drawdown': number;
  'DC Pension Balance': number;
  'DB Pension'?: number;
  'State Pension'?: number;
  'Withdraw from Savings': number;
  'TOTAL INCOME': number;
  'Income Subject to Tax': number;
  'Income Tax Paid': number;
  'Net Income Per Year': number;
  'Net Income Per Month': number;
  // Internal tracking for total savings
  'Savings Balance': number;
}

export interface PensionCalculationParameters {
  currentAge: number;
  projectionStartYear: number;
  initialSavingsAmount: number;
  initialDbPensionAmount: number;
  dbPensionStartAge: number; // Age when DB pension starts
  statePensionAge: number;
  initialStatePensionAmount: number;
  initialDcPensionValue: number;
  investmentPercentageGrowth: number;
  inflationRate: number;
  dcWithdrawalRate: number; // For DC UFPLS post-State Pension Age
  annualChargeAMC: number;
  targetAnnualGrossIncome: number; // New input
}

export interface CalculatedPensionData {
  rows: PensionDataRow[];
  headers: string[];
  parameters: PensionCalculationParameters;
  csvString: string;
}

// Constants for tax calculation
export const PERSONAL_ALLOWANCE = 12400;
export const INCOME_TAX_RATE = 0.20;
export const UFPLS_TAX_FREE_PORTION = 0.25;
