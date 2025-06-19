
export interface PensionDataRow {
  [key: string]: string | number | undefined;
  Age: number;
  Year: string;

  'Initial DC Pension': number;
  'DC Pension Contribution': number;
  'DC Pension Growth': number;
  'DC Pension + Growth': number;
  'DC AMC Charge': number;
  'DC Minus AMC': number;
  'DC Pension Drawdown': number;
  'DC Pension Balance': number;

  'Initial SIPP': number;
  'SIPP Contribution': number;
  'SIPP Growth': number;
  'SIPP + Growth': number;
  'SIPP AMC Charge': number;
  'SIPP Minus AMC': number;
  'SIPP Drawdown': number;
  'SIPP Balance': number;

  'DB Pension'?: number;
  'State Pension'?: number;

  'Cash Savings Initial': number;
  'Withdraw from Cash': number;
  'Cash Savings Balance': number;

  'ISA Initial': number;
  'ISA Growth': number;
  'ISA Value Before Withdrawal': number;
  'Withdraw from ISA': number;
  'ISA Balance': number;

  'GIA Initial': number;
  'GIA Growth': number;
  'GIA Value Before Withdrawal': number;
  'Withdraw from GIA': number;
  'GIA Balance': number;
  
  'Total Savings Withdrawn': number;
  'Total Savings Balance': number;

  'TOTAL INCOME': number;
  'Income Subject to Tax': number;
  'Income Tax Paid': number;
  'Net Income Per Year': number;
  'Net Income Per Month': number;
}

export interface PensionCalculationParameters {
  currentAge: number;
  projectionStartYear: number;
  targetAnnualNetIncome: number;

  initialDbPensionAmount: number;
  dbPensionStartAge: number;
  statePensionAge: number;
  initialStatePensionAmount: number;

  initialDcPensionValue: number;
  annualDcPensionContribution: number;
  dcContributionStartAge: number;
  dcContributionEndAge: number;
  investmentPercentageGrowth: number;
  inflationRate: number;
  dcWithdrawalRate: number;
  annualChargeAMC: number;
  takeTaxFreeLumpSum: boolean;

  initialSippValue: number;
  annualSippContribution: number;
  sippContributionStartAge: number;
  sippContributionEndAge: number;
  sippInvestmentPercentageGrowth: number;
  sippAnnualChargeAMC: number;
  sippWithdrawalRate: number;
  takeSippTaxFreeLumpSum: boolean;

  initialCashSavings: number;
  initialIsaAmount: number;
  isaGrowthRate: number;
  initialGiaAmount: number;
  giaGrowthRate: number;
}

export interface CalculatedPensionData {
  rows: PensionDataRow[];
  headers: string[];
  parameters: PensionCalculationParameters & { 
    taxFreeLumpSumTaken?: number;
    sippTaxFreeLumpSumTaken?: number;
  };
  csvString: string;
}

export const PERSONAL_ALLOWANCE = 12400;
export const INCOME_TAX_RATE = 0.20;
export const UFPLS_TAX_FREE_PORTION = 0.25;
