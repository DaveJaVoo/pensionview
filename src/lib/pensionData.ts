
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';

export const DEFAULT_HEADERS = [
  'Age', 'Year',
  'Initial DC Pension', 'DC Pension Growth', 'DC Pension + Growth',
  'DC AMC Charge', 'DC Minus AMC', 'DC UFPLS Drawdown', 'DC Pension Balance',
  'DB Pension', 'State Pension', 'Withdraw from Savings',
  'TOTAL INCOME', 'Income Subject to Tax', 'Income Tax Paid',
  'Net Income Per Year', 'Net Income Per Month',
  // 'Savings Balance' // Might not display this one, but used for calcs
];

export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, projectionStartYear, initialSavingsAmount,
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
      'Withdraw from Savings': 0, // Default to 0, can be made dynamic later
      'TOTAL INCOME': 0,
      'Income Subject to Tax': 0,
      'Income Tax Paid': 0,
      'Net Income Per Year': 0,
      'Net Income Per Month': 0,
      'Savings Balance': currentSavingsBalance,
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

    // Column H: DC UFPLS Drawdown
    if (age >= statePensionAge) {
      // Use previous year's balance for drawdown calculation if not the first year of drawdown
      const basisForDrawdown = previousRow && previousRow['Age'] === age -1 && age > statePensionAge ? 
                               (previousRow['DC Pension Balance'] || 0) : 
                               row['DC Minus AMC'];
      row['DC UFPLS Drawdown'] = basisForDrawdown * dcWithdrawDecimal;
    } else {
      row['DC UFPLS Drawdown'] = 0;
    }
    // Ensure drawdown doesn't exceed available balance
    row['DC UFPLS Drawdown'] = Math.max(0, Math.min(row['DC UFPLS Drawdown'], row['DC Minus AMC']));


    // Column I: DC Pension Balance
    row['DC Pension Balance'] = row['DC Minus AMC'] - row['DC UFPLS Drawdown'];
    row['DC Pension Balance'] = Math.max(0, row['DC Pension Balance']);


    // Column J: DB Pension
    if (age === dbPensionStartAge) {
      row['DB Pension'] = initialDbPensionAmount;
    } else if (age > dbPensionStartAge && previousRow && previousRow['DB Pension']) {
      row['DB Pension'] = previousRow['DB Pension'] * (1 + inflationDecimal);
    } else {
      row['DB Pension'] = 0;
    }
    row['DB Pension'] = Math.max(0, row['DB Pension'] || 0);


    // Column K: State Pension
    if (age === statePensionAge) {
      row['State Pension'] = initialStatePensionAmount;
    } else if (age > statePensionAge && previousRow && previousRow['State Pension']) {
      row['State Pension'] = previousRow['State Pension'] * (1 + inflationDecimal);
    } else {
      row['State Pension'] = 0;
    }
    row['State Pension'] = Math.max(0, row['State Pension'] || 0);

    // Column L: Withdraw from Savings
    // For now, keeping it simple: 0. This can be expanded.
    // If we were to implement "use savings to meet a need":
    // const incomeTarget = X; // Some desired income
    // const pensionIncome = row['DC UFPLS Drawdown'] + (row['DB Pension'] || 0) + (row['State Pension'] || 0);
    // const shortfall = Math.max(0, incomeTarget - pensionIncome);
    // row['Withdraw from Savings'] = Math.min(shortfall, currentSavingsBalance);
    // currentSavingsBalance -= row['Withdraw from Savings'];
    // row['Savings Balance'] = currentSavingsBalance;
    row['Withdraw from Savings'] = 0; // Placeholder

    // Column M: TOTAL INCOME
    row['TOTAL INCOME'] = (row['DC UFPLS Drawdown'] || 0) + (row['DB Pension'] || 0) + (row['State Pension'] || 0) + row['Withdraw from Savings'];

    // Tax Calculations
    const taxableDCDrawdown = (row['DC UFPLS Drawdown'] || 0) * (1 - UFPLS_TAX_FREE_PORTION);
    const taxableBaseIncome = taxableDCDrawdown + (row['DB Pension'] || 0) + (row['State Pension'] || 0);
    // Assuming 'Withdraw from Savings' is not income-taxable capital

    // Column N: Income Subject to Tax (Assessable Income after Personal Allowance)
    row['Income Subject to Tax'] = Math.max(0, taxableBaseIncome - PERSONAL_ALLOWANCE);
    
    // Column O: Income Tax Paid
    row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;

    // Column P: Net Income Per Year
    row['Net Income Per Year'] = row['TOTAL INCOME'] - row['Income Tax Paid'];

    // Column Q: Net Income Per Month
    row['Net Income Per Month'] = row['Net Income Per Year'] / 12;

    // Ensure all numeric fields are numbers, default to 0 if NaN or undefined after calculation
    DEFAULT_HEADERS.forEach(header => {
        if (header === 'Year') return; // Skip 'Year' as it's a string
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
        // Format numbers to 2 decimal places for CSV, but allow general display formatting
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
