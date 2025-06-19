
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION as GENERAL_UFPLS_TAX_FREE_PORTION } from './types';

export const DEFAULT_HEADERS = [
  'Age', 'Year',
  'Initial DC Pension', 'DC Pension Growth', 'DC Pension + Growth',
  'DC AMC Charge', 'DC Minus AMC', 'DC Pension Drawdown', 'DC Pension Balance',
  'DB Pension', 'State Pension', 
  'Cash Savings Initial', 'Withdraw from Cash', 'Cash Savings Balance',
  'ISA Initial', 'ISA Growth', 'ISA Value Before Withdrawal', 'Withdraw from ISA', 'ISA Balance',
  'GIA Initial', 'GIA Growth', 'GIA Value Before Withdrawal', 'Withdraw from GIA', 'GIA Balance',
  'Total Savings Withdrawn', 'Total Savings Balance',
  'TOTAL INCOME', 'Income Subject to Tax', 'Income Tax Paid',
  'Net Income Per Year', 'Net Income Per Month',
];

// Helper function for iterative net income targeting
function calculateDrawdownsForNetTarget(
  targetNetIncomeThisYear: number,
  dbPensionThisYear: number,
  statePensionThisYear: number,
  currentDCPotForDrawdown: number, // DC Minus AMC
  currentCashBalance: number,
  currentIsaValueBeforeWithdrawal: number,
  currentGiaValueBeforeWithdrawal: number,
  ufplsTaxFreePortionToUse: number // Dynamic: 0 if PCLS taken, 0.25 otherwise
): { 
  dcDrawdown: number; 
  cashWithdrawal: number; 
  isaWithdrawal: number; 
  giaWithdrawal: number; 
  calculatedNet: number; 
  taxPaid: number; 
  incomeSubjectToTax: number; 
  totalGrossIncome: number 
} {
  let bestGuess = { 
    dcDrawdown: 0, 
    cashWithdrawal: 0, 
    isaWithdrawal: 0, 
    giaWithdrawal: 0, 
    calculatedNet: 0, 
    taxPaid: 0, 
    incomeSubjectToTax: 0, 
    totalGrossIncome: 0 
  };
  let minDiff = Infinity;

  const maxIterations = 100;
  const precision = 1.0;

  let lowDcDrawdown = 0;
  let highDcDrawdown = currentDCPotForDrawdown;

  for (let iter = 0; iter < maxIterations; iter++) {
    const currentDcDrawdownGuess = (lowDcDrawdown + highDcDrawdown) / 2;

    const taxableDCDrawdown = currentDcDrawdownGuess * (1 - ufplsTaxFreePortionToUse);
    const grossPensionIncome = dbPensionThisYear + statePensionThisYear + currentDcDrawdownGuess;
    
    const taxableBaseIncome = dbPensionThisYear + statePensionThisYear + taxableDCDrawdown;
    const incomeSubjectToTaxCalc = Math.max(0, taxableBaseIncome - PERSONAL_ALLOWANCE); // Assuming PA doesn't inflate for this internal calc for simplicity, applied later
    const taxPaidOnPensions = incomeSubjectToTaxCalc * INCOME_TAX_RATE;
    
    const netIncomeFromPensions = grossPensionIncome - taxPaidOnPensions;
    
    let shortfallToMeet = targetNetIncomeThisYear - netIncomeFromPensions;
    let tempCashWithdrawal = 0;
    let tempIsaWithdrawal = 0;
    let tempGiaWithdrawal = 0;

    if (shortfallToMeet > 0) {
      tempCashWithdrawal = Math.min(shortfallToMeet, currentCashBalance);
      shortfallToMeet -= tempCashWithdrawal;
    }
    if (shortfallToMeet > 0) {
      tempIsaWithdrawal = Math.min(shortfallToMeet, currentIsaValueBeforeWithdrawal);
      shortfallToMeet -= tempIsaWithdrawal;
    }
    if (shortfallToMeet > 0) {
      tempGiaWithdrawal = Math.min(shortfallToMeet, currentGiaValueBeforeWithdrawal);
    }
    
    const totalSavingsWithdrawnThisGuess = tempCashWithdrawal + tempIsaWithdrawal + tempGiaWithdrawal;
    const finalNetIncome = netIncomeFromPensions + totalSavingsWithdrawnThisGuess;
    const totalGrossIncomeCalc = grossPensionIncome + totalSavingsWithdrawnThisGuess;

    const diff = Math.abs(finalNetIncome - targetNetIncomeThisYear);
    if (diff < minDiff) {
      minDiff = diff;
      bestGuess = { 
        dcDrawdown: currentDcDrawdownGuess, 
        cashWithdrawal: tempCashWithdrawal, 
        isaWithdrawal: tempIsaWithdrawal,
        giaWithdrawal: tempGiaWithdrawal,
        calculatedNet: finalNetIncome,
        taxPaid: taxPaidOnPensions, // This tax is only on pension income initially
        incomeSubjectToTax: incomeSubjectToTaxCalc, // ditto
        totalGrossIncome: totalGrossIncomeCalc
      };
    }

    if (minDiff <= precision && finalNetIncome >= targetNetIncomeThisYear) { // Prefer solutions that meet or exceed target slightly
      break; 
    }

    if (finalNetIncome < targetNetIncomeThisYear) {
      lowDcDrawdown = currentDcDrawdownGuess;
    } else {
      highDcDrawdown = currentDcDrawdownGuess;
    }
  }
  
  bestGuess.dcDrawdown = Math.max(0, Math.min(bestGuess.dcDrawdown, currentDCPotForDrawdown));
  
  // Recalculate based on bestGuess.dcDrawdown to ensure consistency
  const finalTaxableDCDrawdown = bestGuess.dcDrawdown * (1 - ufplsTaxFreePortionToUse);
  const finalGrossPensionIncome = dbPensionThisYear + statePensionThisYear + bestGuess.dcDrawdown;
  const finalTaxableBaseIncome = dbPensionThisYear + statePensionThisYear + finalTaxableDCDrawdown;
  bestGuess.incomeSubjectToTax = Math.max(0, finalTaxableBaseIncome - PERSONAL_ALLOWANCE); // PA will be inflated outside
  bestGuess.taxPaid = bestGuess.incomeSubjectToTax * INCOME_TAX_RATE;
  const finalNetIncomeFromPensions = finalGrossPensionIncome - bestGuess.taxPaid;

  let finalShortfallToMeet = targetNetIncomeThisYear - finalNetIncomeFromPensions;
  bestGuess.cashWithdrawal = 0;
  bestGuess.isaWithdrawal = 0;
  bestGuess.giaWithdrawal = 0;

  if (finalShortfallToMeet > 0) {
    bestGuess.cashWithdrawal = Math.min(finalShortfallToMeet, currentCashBalance);
    finalShortfallToMeet -= bestGuess.cashWithdrawal;
  }
  if (finalShortfallToMeet > 0) {
    bestGuess.isaWithdrawal = Math.min(finalShortfallToMeet, currentIsaValueBeforeWithdrawal);
    finalShortfallToMeet -= bestGuess.isaWithdrawal;
  }
  if (finalShortfallToMeet > 0) {
    bestGuess.giaWithdrawal = Math.min(finalShortfallToMeet, currentGiaValueBeforeWithdrawal);
  }
  
  const finalTotalSavingsWithdrawn = bestGuess.cashWithdrawal + bestGuess.isaWithdrawal + bestGuess.giaWithdrawal;
  bestGuess.calculatedNet = finalNetIncomeFromPensions + finalTotalSavingsWithdrawn;
  bestGuess.totalGrossIncome = finalGrossPensionIncome + finalTotalSavingsWithdrawn;
  
  return bestGuess;
}


export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, projectionStartYear, targetAnnualNetIncome,
    initialDbPensionAmount, dbPensionStartAge,
    statePensionAge, initialStatePensionAmount,
    initialDcPensionValue: totalInitialDcPensionValue,
    investmentPercentageGrowth,
    inflationRate, dcWithdrawalRate, annualChargeAMC,
    takeTaxFreeLumpSum,
    initialCashSavings, initialIsaAmount, isaGrowthRate, initialGiaAmount, giaGrowthRate
  } = params;

  const rows: PensionDataRow[] = [];
  let previousRow: PensionDataRow | null = null;
  
  let currentCashBalance = initialCashSavings;
  let currentIsaBalance = initialIsaAmount;
  let currentGiaBalance = initialGiaAmount;

  const invGrowthDecimal = (investmentPercentageGrowth || 0) / 100;
  const inflationDecimal = (inflationRate || 0) / 100;
  const amcDecimal = (annualChargeAMC || 0) / 100;
  const dcWithdrawDecimal = (dcWithdrawalRate || 0) / 100;
  const isaGrowthDecimal = (isaGrowthRate || 0) / 100;
  const giaGrowthDecimal = (giaGrowthRate || 0) / 100;

  let actualInitialDcPensionForProjection = totalInitialDcPensionValue;
  let taxFreeLumpSumTakenAmount = 0;
  let currentUfplsTaxFreePortion = GENERAL_UFPLS_TAX_FREE_PORTION;

  if (takeTaxFreeLumpSum) {
    taxFreeLumpSumTakenAmount = totalInitialDcPensionValue * 0.25;
    actualInitialDcPensionForProjection = totalInitialDcPensionValue * 0.75;
    currentUfplsTaxFreePortion = 0;
  }

  const outputParameters = { ...params, taxFreeLumpSumTaken: taxFreeLumpSumTakenAmount };

  for (let age = currentAge; age <= 90; age++) {
    const yearOffset = age - currentAge;
    const currentYearStr = (projectionStartYear + yearOffset).toString();
    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);

    const row: PensionDataRow = {
      Age: age,
      Year: currentYearStr,
      'Initial DC Pension': 0,
      'DC Pension Growth': 0,
      'DC Pension + Growth': 0,
      'DC AMC Charge': 0,
      'DC Minus AMC': 0,
      'DC Pension Drawdown': 0,
      'DC Pension Balance': 0,
      'DB Pension': 0,
      'State Pension': 0,
      'Cash Savings Initial': previousRow ? (previousRow['Cash Savings Balance'] || 0) : initialCashSavings,
      'Withdraw from Cash': 0,
      'Cash Savings Balance': 0,
      'ISA Initial': previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount,
      'ISA Growth': 0,
      'ISA Value Before Withdrawal': 0,
      'Withdraw from ISA': 0,
      'ISA Balance': 0,
      'GIA Initial': previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount,
      'GIA Growth': 0,
      'GIA Value Before Withdrawal': 0,
      'Withdraw from GIA': 0,
      'GIA Balance': 0,
      'Total Savings Withdrawn': 0,
      'Total Savings Balance': 0,
      'TOTAL INCOME': 0,
      'Income Subject to Tax': 0,
      'Income Tax Paid': 0,
      'Net Income Per Year': 0,
      'Net Income Per Month': 0,
    };

    // DC Pension calculations
    row['Initial DC Pension'] = previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection;
    row['DC Pension Growth'] = row['Initial DC Pension'] * invGrowthDecimal;
    row['DC Pension + Growth'] = row['Initial DC Pension'] + row['DC Pension Growth'];
    row['DC AMC Charge'] = row['DC Pension + Growth'] * amcDecimal;
    row['DC Minus AMC'] = row['DC Pension + Growth'] - row['DC AMC Charge'];

    // Savings Growth
    row['ISA Growth'] = row['ISA Initial'] * isaGrowthDecimal;
    row['ISA Value Before Withdrawal'] = row['ISA Initial'] + row['ISA Growth'];
    row['GIA Growth'] = row['GIA Initial'] * giaGrowthDecimal;
    row['GIA Value Before Withdrawal'] = row['GIA Initial'] + row['GIA Growth'];
    // Cash has no growth

    // DB Pension Calculation
    if (initialDbPensionAmount > 0) {
        if (age < dbPensionStartAge) {
            row['DB Pension'] = 0;
        } else {
            if (!previousRow) {
                if (currentAge === dbPensionStartAge) row['DB Pension'] = initialDbPensionAmount;
                else row['DB Pension'] = initialDbPensionAmount * Math.pow(1 + inflationDecimal, currentAge - dbPensionStartAge);
            } else {
                if ((previousRow['DB Pension'] || 0) > 0) row['DB Pension'] = (previousRow['DB Pension'] || 0) * (1 + inflationDecimal);
                else if (age === dbPensionStartAge) row['DB Pension'] = initialDbPensionAmount;
                else row['DB Pension'] = 0; 
            }
        }
    }
    row['DB Pension'] = Math.max(0, row['DB Pension'] || 0);

    // State Pension Calculation
    if (initialStatePensionAmount > 0) {
        if (age < statePensionAge) {
            row['State Pension'] = 0;
        } else {
            if (!previousRow) {
                if (currentAge === statePensionAge) row['State Pension'] = initialStatePensionAmount;
                else row['State Pension'] = initialStatePensionAmount * Math.pow(1 + inflationDecimal, currentAge - statePensionAge);
            } else {
                if ((previousRow['State Pension'] || 0) > 0) row['State Pension'] = (previousRow['State Pension'] || 0) * (1 + inflationDecimal);
                else if (age === statePensionAge) row['State Pension'] = initialStatePensionAmount;
                else row['State Pension'] = 0;
            }
        }
    }
    row['State Pension'] = Math.max(0, row['State Pension'] || 0);

    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);
    
    const { dcDrawdown, cashWithdrawal, isaWithdrawal, giaWithdrawal, calculatedNet, taxPaid, incomeSubjectToTax, totalGrossIncome } = 
      calculateDrawdownsForNetTarget(
        inflatedTargetNetIncome,
        row['DB Pension'] || 0,
        row['State Pension'] || 0,
        row['DC Minus AMC'], 
        row['Cash Savings Initial'], // Use initial for the year for this calculation
        row['ISA Value Before Withdrawal'], // Use grown value for this calculation
        row['GIA Value Before Withdrawal'], // Use grown value for this calculation
        currentUfplsTaxFreePortion
      );
    
    let finalDcDrawdown = dcDrawdown;
    let finalCashWithdrawal = cashWithdrawal;
    let finalIsaWithdrawal = isaWithdrawal;
    let finalGiaWithdrawal = giaWithdrawal;

    row['Income Subject to Tax'] = Math.max(0, ((row['DB Pension'] || 0) + (row['State Pension'] || 0) + (finalDcDrawdown * (1-currentUfplsTaxFreePortion))) - currentPersonalAllowance);
    row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;
    row['TOTAL INCOME'] = (row['DB Pension'] || 0) + (row['State Pension'] || 0) + finalDcDrawdown + finalCashWithdrawal + finalIsaWithdrawal + finalGiaWithdrawal; 
    row['Net Income Per Year'] = row['TOTAL INCOME'] - row['Income Tax Paid'];

    let dcDrawdownByRate = 0;
    if (age >= statePensionAge) {
      const basisForRateDrawdown = previousRow ? (previousRow['DC Pension Balance'] || 0) : row['DC Minus AMC'];
      dcDrawdownByRate = basisForRateDrawdown * dcWithdrawDecimal;
    }
    
    // If % rate drawdown is higher, it takes precedence (and savings are not used to top up to target, but are preserved)
    if (dcDrawdownByRate > finalDcDrawdown && age >= statePensionAge) {
         finalDcDrawdown = dcDrawdownByRate;
         // Recalculate tax and net income based on this new DC drawdown, assuming no savings withdrawal for income need
         finalCashWithdrawal = 0;
         finalIsaWithdrawal = 0;
         finalGiaWithdrawal = 0;

         const taxableDCDrawdownRate = finalDcDrawdown * (1 - currentUfplsTaxFreePortion);
         const taxableBaseIncomeRate = (row['DB Pension'] || 0) + (row['State Pension'] || 0) + taxableDCDrawdownRate;
         row['Income Subject to Tax'] = Math.max(0, taxableBaseIncomeRate - currentPersonalAllowance);
         row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;
         row['TOTAL INCOME'] = (row['DB Pension'] || 0) + (row['State Pension'] || 0) + finalDcDrawdown; 
         row['Net Income Per Year'] = row['TOTAL INCOME'] - row['Income Tax Paid'];
    }
    
    row['DC Pension Drawdown'] = Math.max(0, Math.min(finalDcDrawdown, row['DC Minus AMC']));
    
    row['Withdraw from Cash'] = Math.min(finalCashWithdrawal, row['Cash Savings Initial']);
    row['Cash Savings Balance'] = row['Cash Savings Initial'] - row['Withdraw from Cash'];
    
    row['Withdraw from ISA'] = Math.min(finalIsaWithdrawal, row['ISA Value Before Withdrawal']);
    row['ISA Balance'] = row['ISA Value Before Withdrawal'] - row['Withdraw from ISA'];

    row['Withdraw from GIA'] = Math.min(finalGiaWithdrawal, row['GIA Value Before Withdrawal']);
    row['GIA Balance'] = row['GIA Value Before Withdrawal'] - row['Withdraw from GIA'];

    row['Total Savings Withdrawn'] = row['Withdraw from Cash'] + row['Withdraw from ISA'] + row['Withdraw from GIA'];
    row['Total Savings Balance'] = row['Cash Savings Balance'] + row['ISA Balance'] + row['GIA Balance'];
    
    row['DC Pension Balance'] = row['DC Minus AMC'] - row['DC Pension Drawdown'];
    row['DC Pension Balance'] = Math.max(0, row['DC Pension Balance']);
    
    row['Net Income Per Month'] = row['Net Income Per Year'] / 12;

    DEFAULT_HEADERS.forEach(header => {
        if (header === 'Year') return; 
        const val = row[header];
        if (typeof val === 'number') {
          row[header] = parseFloat(val.toFixed(2));
          if (isNaN(row[header] as number)) row[header] = 0;
        } else if (val === undefined) {
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

  return { rows, headers: DEFAULT_HEADERS, parameters: outputParameters, csvString };
}
