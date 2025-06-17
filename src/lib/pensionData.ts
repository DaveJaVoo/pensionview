
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { formatCurrency, parseCurrency } from './utils'; // Assuming parseCurrency might still be useful for direct inputs if needed

export const DEFAULT_HEADERS = [
  'AGE', 'YEAR', 
  'INITIAL DC PENSION', 'DC PENSION GROWTH @ % SHOWN BELOW', 'DC PENSION PLUS GROWTH', 
  'DC PENSION AMC CHARGE @ % SHOWN BELOW', 'DC PENSION MINUS CHARGES', 
  'DC PENSION UFPLS DRAWDOWN', 'DC PENSION BALANCE', 
  'DB PENSION (FAS)', 'STATE PENSION', 
  'MY INCOME PER YEAR', "KATE'S INCOME PER YEAR", 'JOINT INCOME PER YEAR',
  'TOTAL INCOME', 'TAXABLE INCOME = DRAWDOWN + FAS + STATE', 'INCOME TAX PAID'
];

export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, projectionEndAge, initialDcPensionValue, investmentPercentageGrowth,
    annualChargeAMC, withdrawalRatePost66, inflationRate,
    ufplsAge63, ufplsAge64, ufplsAge65, ufplsAge66,
    initialDbPensionAmount, dbPensionStartAge,
    initialStatePensionAmount, statePensionStartAge,
    myInitialAnnualIncome, katesInitialAnnualIncome, averageTaxRate
  } = params;

  const rows: PensionDataRow[] = [];
  let previousRow: PensionDataRow | null = null;

  const invGrowthDecimal = investmentPercentageGrowth / 100;
  const amcDecimal = annualChargeAMC / 100;
  const withdrawDecimal = withdrawalRatePost66 / 100;
  const inflationDecimal = inflationRate / 100;
  const avgTaxDecimal = averageTaxRate / 100;

  const currentYear = new Date().getFullYear();

  for (let age = currentAge; age <= projectionEndAge; age++) {
    const yearOffset = age - currentAge;
    const yearStr = (currentYear + yearOffset).toString();
    const row: PensionDataRow = {
      AGE: age,
      YEAR: yearStr,
      'INITIAL DC PENSION': 0,
      'DC PENSION GROWTH @ % SHOWN BELOW': 0,
      'DC PENSION PLUS GROWTH': 0,
      'DC PENSION AMC CHARGE @ % SHOWN BELOW': 0,
      'DC PENSION MINUS CHARGES': 0,
      'DC PENSION UFPLS DRAWDOWN': 0,
      'DC PENSION BALANCE': 0,
      'DB PENSION (FAS)': undefined,
      'STATE PENSION': undefined,
      'MY INCOME PER YEAR': 0,
      "KATE'S INCOME PER YEAR": 0,
      'JOINT INCOME PER YEAR': 0,
      'TOTAL INCOME': 0,
      'TAXABLE INCOME = DRAWDOWN + FAS + STATE': 0,
      'INCOME TAX PAID': 'NO TAX',
    };

    // DC Pension Calculations
    row['INITIAL DC PENSION'] = previousRow ? previousRow['DC PENSION BALANCE'] : initialDcPensionValue;
    row['DC PENSION GROWTH @ % SHOWN BELOW'] = row['INITIAL DC PENSION'] * invGrowthDecimal;
    row['DC PENSION PLUS GROWTH'] = row['INITIAL DC PENSION'] + row['DC PENSION GROWTH @ % SHOWN BELOW'];
    row['DC PENSION AMC CHARGE @ % SHOWN BELOW'] = row['DC PENSION PLUS GROWTH'] * amcDecimal;
    row['DC PENSION MINUS CHARGES'] = row['DC PENSION PLUS GROWTH'] - row['DC PENSION AMC CHARGE @ % SHOWN BELOW'];

    if (age === 63 && ufplsAge63 !== undefined) row['DC PENSION UFPLS DRAWDOWN'] = ufplsAge63;
    else if (age === 64 && ufplsAge64 !== undefined) row['DC PENSION UFPLS DRAWDOWN'] = ufplsAge64;
    else if (age === 65 && ufplsAge65 !== undefined) row['DC PENSION UFPLS DRAWDOWN'] = ufplsAge65;
    else if (age === 66 && ufplsAge66 !== undefined) row['DC PENSION UFPLS DRAWDOWN'] = ufplsAge66;
    else if (age > 66) row['DC PENSION UFPLS DRAWDOWN'] = row['DC PENSION MINUS CHARGES'] * withdrawDecimal;
    else row['DC PENSION UFPLS DRAWDOWN'] = 0; // Default if not specified for ages <63 or those specific years

    row['DC PENSION BALANCE'] = row['DC PENSION MINUS CHARGES'] - row['DC PENSION UFPLS DRAWDOWN'];
    if (row['DC PENSION BALANCE'] < 0) row['DC PENSION BALANCE'] = 0; // Cannot go below zero

    // DB Pension (FAS)
    if (dbPensionStartAge !== undefined && initialDbPensionAmount !== undefined) {
      if (age === dbPensionStartAge) {
        row['DB PENSION (FAS)'] = initialDbPensionAmount;
      } else if (age > dbPensionStartAge && previousRow && previousRow['DB PENSION (FAS)'] !== undefined) {
        row['DB PENSION (FAS)'] = previousRow['DB PENSION (FAS)']! * (1 + inflationDecimal);
      }
    }
    
    // State Pension
    if (statePensionStartAge !== undefined && initialStatePensionAmount !== undefined) {
      if (age === statePensionStartAge) {
        row['STATE PENSION'] = initialStatePensionAmount;
      } else if (age > statePensionStartAge && previousRow && previousRow['STATE PENSION'] !== undefined) {
        row['STATE PENSION'] = previousRow['STATE PENSION']! * (1 + inflationDecimal);
      }
    }

    // My Income & Kate's Income (inflating from initial)
    if (yearOffset === 0) {
      row['MY INCOME PER YEAR'] = myInitialAnnualIncome;
      row["KATE'S INCOME PER YEAR"] = katesInitialAnnualIncome;
    } else if (previousRow) {
      row['MY INCOME PER YEAR'] = previousRow['MY INCOME PER YEAR'] * (1 + inflationDecimal);
      row["KATE'S INCOME PER YEAR"] = previousRow["KATE'S INCOME PER YEAR"] * (1 + inflationDecimal);
    }
    row['MY INCOME PER MONTH'] = row['MY INCOME PER YEAR'] / 12;
    row["KATE'S INCOME PER MONTH"] = row["KATE'S INCOME PER YEAR"] / 12;


    row['JOINT INCOME PER YEAR'] = row['MY INCOME PER YEAR'] + row["KATE'S INCOME PER YEAR"];
    row['JOINT INCOME PER MONTH'] = row['JOINT INCOME PER YEAR'] / 12;

    // Taxable Pension Income
    row['TAXABLE INCOME = DRAWDOWN + FAS + STATE'] = 
      (row['DC PENSION UFPLS DRAWDOWN'] || 0) + 
      (row['DB PENSION (FAS)'] || 0) + 
      (row['STATE PENSION'] || 0);

    // Total Income (sum of all cash inflows for the year before tax)
    row['TOTAL INCOME'] = 
      (row['DC PENSION UFPLS DRAWDOWN'] || 0) +
      (row['DB PENSION (FAS)'] || 0) +
      (row['STATE PENSION'] || 0) +
      (row['MY INCOME PER YEAR'] || 0) +
      (row["KATE'S INCOME PER YEAR"] || 0);
      // Not including 'WITHDRAW FROM SAVINGS' here as its calculation isn't defined yet.

    // Income Tax Paid (Simplified)
    const taxableIncomeForTaxCalc = row['TAXABLE INCOME = DRAWDOWN + FAS + STATE'] + row['MY INCOME PER YEAR'] + row["KATE'S INCOME PER YEAR"]; // Simplified: all income is taxed
    if (taxableIncomeForTaxCalc > 0 && avgTaxDecimal > 0) {
      row['INCOME TAX PAID'] = taxableIncomeForTaxCalc * avgTaxDecimal;
    } else {
      row['INCOME TAX PAID'] = 'NO TAX';
    }
    
    rows.push(row);
    previousRow = row;
  }

  const csvHeaderString = DEFAULT_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
  const csvRowStrings = rows.map(r => {
    return DEFAULT_HEADERS.map(header => {
      let val = r[header];
      if (typeof val === 'number') {
        return String(val.toFixed(2)); // AI might prefer consistent decimal places
      }
      if (val === undefined || val === null) return "";
      const sVal = String(val);
      return sVal.includes(',') || sVal.includes('"') || sVal.includes('\n') ? `"${sVal.replace(/"/g, '""')}"` : sVal;
    }).join(',');
  });
  const csvString = [csvHeaderString, ...csvRowStrings].join('\n');

  return { rows, headers: DEFAULT_HEADERS, parameters: params, csvString };
}
