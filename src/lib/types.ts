
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
  'WITHDRAW FROM SAVINGS'?: number;
  'TOTAL INCOME': number;
  'TAXABLE INCOME = DRAWDOWN + FAS + STATE'?: number;
  'INCOME TAX PAID': string | number; // Can be "NO TAX" or a number
  'MY INCOME PER YEAR': number;
  'MY INCOME PER MONTH': number;
  "KATE'S INCOME PER YEAR": number;
  "KATE'S INCOME PER MONTH": number;
  'JOINT INCOME PER YEAR': number;
  'JOINT INCOME PER MONTH': number;
}

export interface FinancialParameters {
  initialDcPensionValue: number;
  investmentPercentageGrowth: number;
  inflationRate: number;
  withdrawalRate: number;
  annualChargeAMC: number;
}

export interface ParsedPensionData {
  rows: PensionDataRow[];
  headers: string[];
  parameters: FinancialParameters;
  csvString: string; // The relevant part of CSV for AI
}
