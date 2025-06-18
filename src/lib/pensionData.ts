
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';

export const DEFAULT_HEADERS = [
  'Age', 'Year',
  'Initial DC Pension', 'DC Pension Growth', 'DC Pension + Growth',
  'DC AMC Charge', 'DC Minus AMC', 'DC UFPLS Drawdown', 'DC Pension Balance',
  'DB Pension', 'State Pension', 'Withdraw from Savings', 'Savings Balance', // Added Savings Balance for clarity in CSV/AI
  'TOTAL INCOME', 'Income Subject to Tax', 'Income Tax Paid',
  'Net Income Per Year', 'Net Income Per Month',
];

export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, projectionStartYear, initialSavingsAmount, targetAnnualGrossIncome,
    initialDbPensionAmount, dbPensionStartAge,
    statePensionAge, initialStatePensionAmount,
    initialDcPensionValue, investmentPercentageGrowth,
    inflationRate, dcWithdrawalRate, annualChargeAMC
  } = params;

  const rows: PensionDataRow[] = [];
  let previousRow: PensionDataRow | null = null;
  let currentSavingsBalance = initialSavingsAmount;

  const invGrowthDecimal = (investmentPercentageGrowth || 0) / 100;
  const inflationDecimal = (inflationRate || 0) / 100;
  const amcDecimal = (annualChargeAMC || 0) / 100;
  const dcWithdrawDecimal = (dcWithdrawalRate || 0) / 100;

  for (let age = currentAge; age <= 90; age++) {
    const yearOffset = age - currentAge;
    const currentYearStr = (projectionStartYear + yearOffset).toString();

    const row: PensionDataRow = {
      Age: age,
      Year: currentYearStr,
      'Initial DC Pension': 0,
      'DC Pension Growth': 0,
      'DC Pension + Growth': 0,
      'DC AMC Charge': 0,
      'DC Minus AMC': 0,
      'DC UFPLS Drawdown': 0,
      'DC Pension Balance': 0,
      'DB Pension': 0,
      'State Pension': 0,
      'Withdraw from Savings': 0,
      'Savings Balance': currentSavingsBalance, // Initial per-year savings balance
      'TOTAL INCOME': 0,
      'Income Subject to Tax': 0,
      'Income Tax Paid': 0,
      'Net Income Per Year': 0,
      'Net Income Per Month': 0,
    };

    // Column C: Initial DC Pension
    row['Initial DC Pension'] = previousRow ? (previousRow['DC Pension Balance'] || 0) : initialDcPensionValue;

    // Column D: DC Pension Growth
    row['DC Pension Growth'] = row['Initial DC Pension'] * invGrowthDecimal;

    // Column E: DC Pension + Growth
    row['DC Pension + Growth'] = row['Initial DC Pension'] + row['DC Pension Growth'];

    // Column F: DC Pension AMC Charge
    row['DC AMC Charge'] = row['DC Pension + Growth'] * amcDecimal;

    // Column G: DC Pension Minus AMC Charge
    row['DC Minus AMC'] = row['DC Pension + Growth'] - row['DC AMC Charge'];

    // DB and State Pension for the current year
    if (age === dbPensionStartAge) {
      row['DB Pension'] = initialDbPensionAmount;
    } else if (age > dbPensionStartAge && previousRow && previousRow['DB Pension']) {
      row['DB Pension'] = previousRow['DB Pension'] * (1 + inflationDecimal);
    } else {
      row['DB Pension'] = 0;
    }
    row['DB Pension'] = Math.max(0, row['DB Pension'] || 0);

    if (age === statePensionAge) {
      row['State Pension'] = initialStatePensionAmount;
    } else if (age > statePensionAge && previousRow && previousRow['State Pension']) {
      row['State Pension'] = previousRow['State Pension'] * (1 + inflationDecimal);
    } else {
      row['State Pension'] = 0;
    }
    row['State Pension'] = Math.max(0, row['State Pension'] || 0);
    
    // Calculate income from fixed pensions
    const incomeFromFixedPensions = (row['DB Pension'] || 0) + (row['State Pension'] || 0);
    
    // Calculate shortfall against target gross income
    const shortfall = Math.max(0, targetAnnualGrossIncome - incomeFromFixedPensions);

    // Column L: Withdraw from Savings
    const actualWithdrawalFromSavings = Math.min(shortfall, currentSavingsBalance);
    row['Withdraw from Savings'] = actualWithdrawalFromSavings;
    currentSavingsBalance -= actualWithdrawalFromSavings;
    row['Savings Balance'] = currentSavingsBalance; // Update row's savings balance after withdrawal

    // Remaining shortfall after savings withdrawal
    const remainingShortfall = Math.max(0, shortfall - actualWithdrawalFromSavings);

    // Column H: DC UFPLS Drawdown
    let dcDrawdownToMeetNeed = 0;
    if (remainingShortfall > 0) {
      dcDrawdownToMeetNeed = remainingShortfall;
    }

    let dcDrawdownByRate = 0;
    if (age >= statePensionAge) {
      // Basis for drawdown rate: use previous year's balance if available and post-SPA, otherwise current year's pre-drawdown balance.
      const basisForRateDrawdown = previousRow && previousRow['Age'] === age -1 && age > statePensionAge ? 
                               (previousRow['DC Pension Balance'] || 0) : 
                               row['DC Minus AMC'];
      dcDrawdownByRate = basisForRateDrawdown * dcWithdrawDecimal;
    }
    
    // DC UFPLS Drawdown is the greater of amount needed for shortfall or amount by withdrawal rate (if applicable)
    row['DC UFPLS Drawdown'] = Math.max(dcDrawdownToMeetNeed, dcDrawdownByRate);
    // Ensure drawdown doesn't exceed available DC balance
    row['DC UFPLS Drawdown'] = Math.max(0, Math.min(row['DC UFPLS Drawdown'], row['DC Minus AMC']));


    // Column I: DC Pension Balance
    row['DC Pension Balance'] = row['DC Minus AMC'] - row['DC UFPLS Drawdown'];
    row['DC Pension Balance'] = Math.max(0, row['DC Pension Balance']);

    // Column M: TOTAL INCOME
    row['TOTAL INCOME'] = (row['DC UFPLS Drawdown'] || 0) + (row['DB Pension'] || 0) + (row['State Pension'] || 0) + row['Withdraw from Savings'];

    // Tax Calculations
    const taxableDCDrawdown = (row['DC UFPLS Drawdown'] || 0) * (1 - UFPLS_TAX_FREE_PORTION);
    const taxableBaseIncome = taxableDCDrawdown + (row['DB Pension'] || 0) + (row['State Pension'] || 0);
    // Note: 'Withdraw from Savings' is assumed to be from post-tax capital and not income-taxable here.

    // Column N: Income Subject to Tax
    row['Income Subject to Tax'] = Math.max(0, taxableBaseIncome - PERSONAL_ALLOWANCE);
    
    // Column O: Income Tax Paid
    row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;

    // Column P: Net Income Per Year
    row['Net Income Per Year'] = row['TOTAL INCOME'] - row['Income Tax Paid'];

    // Column Q: Net Income Per Month
    row['Net Income Per Month'] = row['Net Income Per Year'] / 12;

    DEFAULT_HEADERS.forEach(header => {
        if (header === 'Year') return; 
        if (typeof row[header] === 'number' && isNaN(row[header] as number)) {
            row[header] = 0;
        } else if (row[header] === undefined) {
            row[header] = 0;
        }
    });

    rows.push(row);
    previousRow = row;
  }

  const csvHeaderString = DEFAULT_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
  const csvRowStrings = rows.map(r => {
    return DEFAULT_HEADERS.map(header => {
      let val = r[header];
      if (typeof val === 'number') {
        if (isNaN(val)) return "";
        return String(parseFloat(val.toFixed(2))); 
      }
      if (val === undefined || val === null) return "";
      const sVal = String(val);
      return sVal.includes(',') || sVal.includes('"') || sVal.includes('\n') ? `"${sVal.replace(/"/g, '""')}"` : sVal;
    }).join(',');
  });
  const csvString = [csvHeaderString, ...csvRowStrings].join('\n');

  return { rows, headers: DEFAULT_HEADERS, parameters: params, csvString };
}
