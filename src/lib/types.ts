
export interface PensionDataRow {
  [key: string]: string | number | undefined;
  Age: number;
  Year: string;

  'Initial DC Pension': number;
  'DC Pension Drawdown': number;
  'DC Pension Contribution': number;
  'DC AMC Charge': number;
  'DC Pension Growth': number;
  'DC Pension After Deductions': number;
  'DC Pension Balance': number;

  'Initial SIPP'?: number;
  'SIPP Drawdown'?: number;
  'SIPP Contribution'?: number;
  'SIPP AMC Charge'?: number;
  'SIPP Growth'?: number;
  'SIPP After Deductions'?: number;
  'SIPP Balance'?: number;

  'DB Pension'?: number;
  'FAS Pension'?: number;
  'State Pension'?: number;
  'Other Income'?: number;

  'Cash Savings Initial'?: number;
  'Cash Savings Contribution'?: number;
  'Withdraw from Cash'?: number;
  'Cash Savings Balance'?: number;

  'ISA Initial'?: number;
  'ISA Contribution'?: number;
  'ISA Growth'?: number;
  'ISA Value Before Withdrawal'?: number;
  'Withdraw from ISA'?: number;
  'ISA Balance'?: number;

  'GIA Initial'?: number;
  'GIA Contribution'?: number;
  'GIA Growth'?: number;
  'GIA Value Before Withdrawal'?: number;
  'Withdraw from GIA'?: number;
  'GIA Balance'?: number;
  
  'Total Savings Withdrawn'?: number;
  'Total Savings Balance'?: number;

  'TOTAL INCOME': number;
  'Income Subject to Tax': number;
  'Income Tax Paid': number;
  'Net Income Per Year': number;
  'Net Income Per Month': number;
}

export interface PensionCalculationParameters {
  currentAge: number;
  retirementAge: number;
  calculationTriggerYear: number;
  projectionEndAge: number;
  targetAnnualNetIncome: number;

  initialDbPensionAmount: number;
  dbPensionStartAge: number;
  fasAmount: number;
  fasStartAge: number;
  statePensionAge: number;
  initialStatePensionAmount: number;

  initialOtherIncome: number;

  initialDcPensionValue: number;
  annualDcPensionContribution: number;
  dcContributionEndAge: number;
  investmentPercentageGrowth: number;
  inflationRate: number;
  dcWithdrawalRate: number;
  annualChargeAMC: number;
  takeTaxFreeLumpSum: boolean;
  applyDcWithdrawalRateInSurplus: boolean;

  initialSippValue: number;
  annualSippContribution: number;
  sippContributionEndAge: number;
  sippInvestmentPercentageGrowth: number;
  sippAnnualChargeAMC: number;
  sippWithdrawalRate: number;
  takeSippTaxFreeLumpSum: boolean;
  applySippRateInSurplus: boolean;

  initialCashSavings: number;
  annualCashContribution: number;
  cashContributionEndAge: number;
  initialIsaAmount: number;
  annualIsaContribution: number;
  isaContributionEndAge: number;
  isaGrowthRate: number;
  initialGiaAmount: number;
  annualGiaContribution: number;
  giaContributionEndAge: number;
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

export const PERSONAL_ALLOWANCE = 12570;
export const INCOME_TAX_RATE = 0.20;
export const UFPLS_TAX_FREE_PORTION = 0.25;
