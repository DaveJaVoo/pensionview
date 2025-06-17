
export interface PensionDataRow {
  [key: string]: string | number | undefined;
  AGE: number;
  YEAR: string;
  'INITIAL DC PENSION': number;
  'DC PENSION GROWTH @ % SHOWN BELOW': number;
  'DC PENSION PLUS GROWTH': number;
  'DC PENSION AMC CHARGE @ % SHOWN BELOW': number;
  'DC PENSION MINUS CHARGES': number;
  'DC PENSION UFPLS DRAWDOWN': number;
  'DC PENSION BALANCE': number;
  'DB PENSION (FAS)'?: number;
  'STATE PENSION'?: number;
  'MY INCOME PER YEAR': number;
  "KATE'S INCOME PER YEAR": number;
  'JOINT INCOME PER YEAR': number;
  'TOTAL INCOME': number; // Sum of all income sources for the year
  'TAXABLE INCOME = DRAWDOWN + FAS + STATE': number; // Taxable part of pension income
  'INCOME TAX PAID': string | number; // Can be "NO TAX" or a number
  'WITHDRAW FROM SAVINGS'?: number; // This column was in the original list, but no calc logic provided yet
}

export interface PensionCalculationParameters {
  currentAge: number;
  projectionEndAge: number;
  initialDcPensionValue: number;
  investmentPercentageGrowth: number;
  annualChargeAMC: number;
  withdrawalRatePost66: number;
  inflationRate: number;
  ufplsAge63?: number;
  ufplsAge64?: number;
  ufplsAge65?: number;
  ufplsAge66?: number;
  initialDbPensionAmount?: number;
  dbPensionStartAge?: number;
  initialStatePensionAmount?: number;
  statePensionStartAge?: number;
  myInitialAnnualIncome: number;
  katesInitialAnnualIncome: number;
  averageTaxRate: number; // For simplified tax calculation
}

export interface CalculatedPensionData {
  rows: PensionDataRow[];
  headers: string[];
  parameters: PensionCalculationParameters; // The input parameters used for this calculation
  csvString: string;
}
