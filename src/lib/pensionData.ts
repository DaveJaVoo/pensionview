
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';

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

  const invGrowthDecimal = (investmentPercentageGrowth || 0) / 100;
  const amcDecimal = (annualChargeAMC || 0) / 100;
  const withdrawDecimal = (withdrawalRatePost66 || 0) / 100;
  const inflationDecimal = (inflationRate || 0) / 100;
  const avgTaxDecimal = (averageTaxRate || 0) / 100;

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
    row['INITIAL DC PENSION'] = previousRow ? (previousRow['DC PENSION BALANCE'] || 0) : (initialDcPensionValue || 0);
    row['DC PENSION GROWTH @ % SHOWN BELOW'] = (row['INITIAL DC PENSION'] || 0) * invGrowthDecimal;
    row['DC PENSION PLUS GROWTH'] = (row['INITIAL DC PENSION'] || 0) + (row['DC PENSION GROWTH @ % SHOWN BELOW'] || 0);
    row['DC PENSION AMC CHARGE @ % SHOWN BELOW'] = (row['DC PENSION PLUS GROWTH'] || 0) * amcDecimal;
    row['DC PENSION MINUS CHARGES'] = (row['DC PENSION PLUS GROWTH'] || 0) - (row['DC PENSION AMC CHARGE @ % SHOWN BELOW'] || 0);

    let specificUfplsAmount: number | undefined = undefined;
    if (age === 63 && ufplsAge63 !== undefined) specificUfplsAmount = ufplsAge63;
    else if (age === 64 && ufplsAge64 !== undefined) specificUfplsAmount = ufplsAge64;
    else if (age === 65 && ufplsAge65 !== undefined) specificUfplsAmount = ufplsAge65;
    else if (age === 66 && ufplsAge66 !== undefined) specificUfplsAmount = ufplsAge66;

    if (specificUfplsAmount !== undefined) {
      row['DC PENSION UFPLS DRAWDOWN'] = specificUfplsAmount;
    } else if (age > 66) {
      row['DC PENSION UFPLS DRAWDOWN'] = (row['DC PENSION MINUS CHARGES'] || 0) * withdrawDecimal;
    } else {
      row['DC PENSION UFPLS DRAWDOWN'] = 0;
    }
    
    // Ensure drawdown doesn't exceed available balance after charges
    row['DC PENSION UFPLS DRAWDOWN'] = Math.min(row['DC PENSION UFPLS DRAWDOWN'] || 0, row['DC PENSION MINUS CHARGES'] || 0);


    row['DC PENSION BALANCE'] = (row['DC PENSION MINUS CHARGES'] || 0) - (row['DC PENSION UFPLS DRAWDOWN'] || 0);
    if (row['DC PENSION BALANCE'] < 0) row['DC PENSION BALANCE'] = 0;

    // DB Pension (FAS)
    if (dbPensionStartAge !== undefined && initialDbPensionAmount !== undefined) {
      if (age === dbPensionStartAge) {
        row['DB PENSION (FAS)'] = initialDbPensionAmount;
      } else if (age > dbPensionStartAge && previousRow && previousRow['DB PENSION (FAS)'] !== undefined) {
        row['DB PENSION (FAS)'] = (previousRow['DB PENSION (FAS)']! || 0) * (1 + inflationDecimal);
      }
    }
    
    // State Pension
    if (statePensionStartAge !== undefined && initialStatePensionAmount !== undefined) {
      if (age === statePensionStartAge) {
        row['STATE PENSION'] = initialStatePensionAmount;
      } else if (age > statePensionStartAge && previousRow && previousRow['STATE PENSION'] !== undefined) {
        row['STATE PENSION'] = (previousRow['STATE PENSION']! || 0) * (1 + inflationDecimal);
      }
    }

    // My Income & Kate's Income (inflating from initial)
    if (yearOffset === 0) {
      row['MY INCOME PER YEAR'] = myInitialAnnualIncome || 0;
      row["KATE'S INCOME PER YEAR"] = katesInitialAnnualIncome || 0;
    } else if (previousRow) {
      row['MY INCOME PER YEAR'] = (previousRow['MY INCOME PER YEAR'] || 0) * (1 + inflationDecimal);
      row["KATE'S INCOME PER YEAR"] = (previousRow["KATE'S INCOME PER YEAR"] || 0) * (1 + inflationDecimal);
    }
    // row['MY INCOME PER MONTH'] = (row['MY INCOME PER YEAR'] || 0) / 12; // Not in DEFAULT_HEADERS
    // row["KATE'S INCOME PER MONTH"] = (row["KATE'S INCOME PER YEAR"] || 0) / 12; // Not in DEFAULT_HEADERS


    row['JOINT INCOME PER YEAR'] = (row['MY INCOME PER YEAR'] || 0) + (row["KATE'S INCOME PER YEAR"] || 0);
    // row['JOINT INCOME PER MONTH'] = (row['JOINT INCOME PER YEAR'] || 0) / 12; // Not in DEFAULT_HEADERS

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

    // Income Tax Paid (Simplified)
    const taxableIncomeForTaxCalc = (row['TAXABLE INCOME = DRAWDOWN + FAS + STATE'] || 0) + (row['MY INCOME PER YEAR'] || 0) + (row["KATE'S INCOME PER YEAR"] || 0);
    if (taxableIncomeForTaxCalc > 0 && avgTaxDecimal > 0) {
      row['INCOME TAX PAID'] = taxableIncomeForTaxCalc * avgTaxDecimal;
    } else {
      row['INCOME TAX PAID'] = 'NO TAX';
    }
    
    // Ensure all numeric fields are numbers, default to 0 if NaN or undefined after calculation
    DEFAULT_HEADERS.forEach(header => {
        if (typeof row[header] === 'number' && isNaN(row[header] as number)) {
            row[header] = 0;
        } else if (row[header] === undefined && 
                   header !== 'DB PENSION (FAS)' && 
                   header !== 'STATE PENSION' && 
                   header !== 'WITHDRAW FROM SAVINGS') { // these can legitimately be undefined
             // Check if it's a field that should be numeric
            const numericHeaders = [
                'INITIAL DC PENSION', 'DC PENSION GROWTH @ % SHOWN BELOW', 'DC PENSION PLUS GROWTH',
                'DC PENSION AMC CHARGE @ % SHOWN BELOW', 'DC PENSION MINUS CHARGES',
                'DC PENSION UFPLS DRAWDOWN', 'DC PENSION BALANCE',
                'MY INCOME PER YEAR', "KATE'S INCOME PER YEAR", 'JOINT INCOME PER YEAR',
                'TOTAL INCOME', 'TAXABLE INCOME = DRAWDOWN + FAS + STATE'
            ];
            if (numericHeaders.includes(header) || (header === 'INCOME TAX PAID' && row['INCOME TAX PAID'] !== 'NO TAX')) {
                 row[header] = 0;
            }
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
        if (isNaN(val)) { // Check for NaN before calling toFixed
          return ""; // Return empty string for CSV if NaN
        }
        return String(val.toFixed(2));
      }
      if (val === undefined || val === null) return ""; // Handle undefined or null for non-numeric types
      const sVal = String(val);
      return sVal.includes(',') || sVal.includes('"') || sVal.includes('\n') ? `"${sVal.replace(/"/g, '""')}"` : sVal;
    }).join(',');
  });
  const csvString = [csvHeaderString, ...csvRowStrings].join('\n');

  return { rows, headers: DEFAULT_HEADERS, parameters: params, csvString };
}

