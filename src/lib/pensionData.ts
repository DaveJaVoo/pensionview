
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION as GENERAL_UFPLS_TAX_FREE_PORTION } from './types';

export const DEFAULT_HEADERS = [
  'Age', 'Year',
  'Initial DC Pension', 'DC Pension Contribution', 'DC Pension Growth', 'DC Pension + Growth',
  'DC AMC Charge', 'DC Minus AMC', 'DC Pension Drawdown', 'DC Pension Balance',
  'Initial SIPP', 'SIPP Contribution', 'SIPP Growth', 'SIPP + Growth',
  'SIPP AMC Charge', 'SIPP Minus AMC', 'SIPP Drawdown', 'SIPP Balance',
  'DB Pension', 'State Pension', 
  'Cash Savings Initial', 'Withdraw from Cash', 'Cash Savings Balance',
  'ISA Initial', 'ISA Growth', 'ISA Value Before Withdrawal', 'Withdraw from ISA', 'ISA Balance',
  'GIA Initial', 'GIA Growth', 'GIA Value Before Withdrawal', 'Withdraw from GIA', 'GIA Balance',
  'Total Savings Withdrawn', 'Total Savings Balance',
  'TOTAL INCOME', 'Income Subject to Tax', 'Income Tax Paid',
  'Net Income Per Year', 'Net Income Per Month',
];

function calculateDrawdownsForNetTarget(
  targetNetIncomeThisYear: number,
  dbPensionThisYear: number,
  statePensionThisYear: number,
  currentDCPotForDrawdown: number,
  dcUfplsTaxFreePortion: number,
  currentSippPotForDrawdown: number,
  sippUfplsTaxFreePortion: number,
  currentCashBalance: number,
  currentIsaValueBeforeWithdrawal: number,
  currentGiaValueBeforeWithdrawal: number,
  currentPersonalAllowance: number
): { 
  dcDrawdown: number;
  sippDrawdown: number;
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
    sippDrawdown: 0,
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

  let lowTotalPensionDrawdown = 0;
  let highTotalPensionDrawdown = currentDCPotForDrawdown + currentSippPotForDrawdown;

  for (let iter = 0; iter < maxIterations; iter++) {
    const currentTotalPensionDrawdownGuess = (lowTotalPensionDrawdown + highTotalPensionDrawdown) / 2;

    let tempDcDrawdown = Math.min(currentTotalPensionDrawdownGuess, currentDCPotForDrawdown);
    let tempSippDrawdown = Math.min(currentTotalPensionDrawdownGuess - tempDcDrawdown, currentSippPotForDrawdown);
    
    tempDcDrawdown = Math.max(0, tempDcDrawdown);
    tempSippDrawdown = Math.max(0, tempSippDrawdown);


    const taxableDCDrawdown = tempDcDrawdown * (1 - dcUfplsTaxFreePortion);
    const taxableSippDrawdown = tempSippDrawdown * (1 - sippUfplsTaxFreePortion);
    const grossPensionIncome = dbPensionThisYear + statePensionThisYear + tempDcDrawdown + tempSippDrawdown;
    
    const taxableBaseIncome = dbPensionThisYear + statePensionThisYear + taxableDCDrawdown + taxableSippDrawdown;
    const incomeSubjectToTaxCalc = Math.max(0, taxableBaseIncome - currentPersonalAllowance);
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
        dcDrawdown: tempDcDrawdown, 
        sippDrawdown: tempSippDrawdown,
        cashWithdrawal: tempCashWithdrawal, 
        isaWithdrawal: tempIsaWithdrawal,
        giaWithdrawal: tempGiaWithdrawal,
        calculatedNet: finalNetIncome,
        taxPaid: taxPaidOnPensions,
        incomeSubjectToTax: incomeSubjectToTaxCalc,
        totalGrossIncome: totalGrossIncomeCalc
      };
    }

    if (minDiff <= precision && finalNetIncome >= targetNetIncomeThisYear) {
      break; 
    }

    if (finalNetIncome < targetNetIncomeThisYear) {
      lowTotalPensionDrawdown = currentTotalPensionDrawdownGuess;
    } else {
      highTotalPensionDrawdown = currentTotalPensionDrawdownGuess;
    }
  }
  
  bestGuess.dcDrawdown = Math.max(0, Math.min(bestGuess.dcDrawdown, currentDCPotForDrawdown));
  bestGuess.sippDrawdown = Math.max(0, Math.min(bestGuess.sippDrawdown, currentSippPotForDrawdown));
  
  const finalTaxableDCDrawdown = bestGuess.dcDrawdown * (1 - dcUfplsTaxFreePortion);
  const finalTaxableSippDrawdown = bestGuess.sippDrawdown * (1 - sippUfplsTaxFreePortion);

  const finalGrossPensionIncome = dbPensionThisYear + statePensionThisYear + bestGuess.dcDrawdown + bestGuess.sippDrawdown;
  const finalTaxableBaseIncome = dbPensionThisYear + statePensionThisYear + finalTaxableDCDrawdown + finalTaxableSippDrawdown;
  bestGuess.incomeSubjectToTax = Math.max(0, finalTaxableBaseIncome - currentPersonalAllowance);
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
    annualDcPensionContribution, dcContributionStartAge, dcContributionEndAge,
    investmentPercentageGrowth, dcWithdrawalRate, annualChargeAMC, takeTaxFreeLumpSum,

    initialSippValue: totalInitialSippValue,
    annualSippContribution, sippContributionStartAge, sippContributionEndAge,
    sippInvestmentPercentageGrowth, sippWithdrawalRate, sippAnnualChargeAMC, takeSippTaxFreeLumpSum,
    
    inflationRate,
    initialCashSavings, initialIsaAmount, isaGrowthRate, initialGiaAmount, giaGrowthRate
  } = params;

  const rows: PensionDataRow[] = [];
  let previousRow: PensionDataRow | null = null;
  
  let currentCashBalance = initialCashSavings;
  let currentIsaBalance = initialIsaAmount;
  let currentGiaBalance = initialGiaAmount;

  const invGrowthDecimal = (investmentPercentageGrowth || 0) / 100;
  const sippInvGrowthDecimal = (sippInvestmentPercentageGrowth || 0) / 100;
  const inflationDecimal = (inflationRate || 0) / 100;
  const amcDecimal = (annualChargeAMC || 0) / 100;
  const sippAmcDecimal = (sippAnnualChargeAMC || 0) / 100;
  const dcWithdrawDecimal = (dcWithdrawalRate || 0) / 100;
  const sippWithdrawDecimal = (sippWithdrawalRate || 0) / 100;
  const isaGrowthDecimal = (isaGrowthRate || 0) / 100;
  const giaGrowthDecimal = (giaGrowthRate || 0) / 100;

  let actualInitialDcPensionForProjection = totalInitialDcPensionValue;
  let taxFreeLumpSumTakenAmount = 0;
  let dcUfplsTaxFreePortion = GENERAL_UFPLS_TAX_FREE_PORTION;

  if (takeTaxFreeLumpSum) {
    taxFreeLumpSumTakenAmount = totalInitialDcPensionValue * 0.25;
    actualInitialDcPensionForProjection = totalInitialDcPensionValue * 0.75;
    dcUfplsTaxFreePortion = 0;
  }

  let actualInitialSippForProjection = totalInitialSippValue;
  let sippTaxFreeLumpSumTakenAmount = 0;
  let sippUfplsTaxFreePortion = GENERAL_UFPLS_TAX_FREE_PORTION;

  if (takeSippTaxFreeLumpSum) {
    sippTaxFreeLumpSumTakenAmount = totalInitialSippValue * 0.25;
    actualInitialSippForProjection = totalInitialSippValue * 0.75;
    sippUfplsTaxFreePortion = 0;
  }

  const outputParameters = { 
    ...params, 
    taxFreeLumpSumTaken: taxFreeLumpSumTakenAmount,
    sippTaxFreeLumpSumTaken: sippTaxFreeLumpSumTakenAmount,
  };

  for (let age = currentAge; age <= 90; age++) {
    const yearOffset = age - currentAge;
    const currentYearStr = (projectionStartYear + yearOffset).toString();
    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);

    const row: PensionDataRow = {
      Age: age,
      Year: currentYearStr,
      'Initial DC Pension': 0,
      'DC Pension Contribution': 0,
      'DC Pension Growth': 0,
      'DC Pension + Growth': 0,
      'DC AMC Charge': 0,
      'DC Minus AMC': 0,
      'DC Pension Drawdown': 0,
      'DC Pension Balance': 0,
      'Initial SIPP': 0,
      'SIPP Contribution': 0,
      'SIPP Growth': 0,
      'SIPP + Growth': 0,
      'SIPP AMC Charge': 0,
      'SIPP Minus AMC': 0,
      'SIPP Drawdown': 0,
      'SIPP Balance': 0,
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

    // DC Pension contributions
    let dcContributionThisYear = 0;
    if (age >= dcContributionStartAge && age < dcContributionEndAge && annualDcPensionContribution > 0) {
      dcContributionThisYear = annualDcPensionContribution;
    }
    row['DC Pension Contribution'] = dcContributionThisYear;

    let dcPotBeforeGrowth = previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection;
    dcPotBeforeGrowth += dcContributionThisYear; 

    row['Initial DC Pension'] = previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection;
    row['DC Pension Growth'] = dcPotBeforeGrowth * invGrowthDecimal;
    row['DC Pension + Growth'] = dcPotBeforeGrowth + row['DC Pension Growth'];
    row['DC AMC Charge'] = row['DC Pension + Growth'] * amcDecimal;
    row['DC Minus AMC'] = row['DC Pension + Growth'] - row['DC AMC Charge'];
    
    // SIPP contributions
    let sippContributionThisYear = 0;
    if (age >= sippContributionStartAge && age < sippContributionEndAge && annualSippContribution > 0) {
      sippContributionThisYear = annualSippContribution;
    }
    row['SIPP Contribution'] = sippContributionThisYear;

    let sippPotBeforeGrowth = previousRow ? (previousRow['SIPP Balance'] || 0) : actualInitialSippForProjection;
    sippPotBeforeGrowth += sippContributionThisYear;

    row['Initial SIPP'] = previousRow ? (previousRow['SIPP Balance'] || 0) : actualInitialSippForProjection;
    row['SIPP Growth'] = sippPotBeforeGrowth * sippInvGrowthDecimal;
    row['SIPP + Growth'] = sippPotBeforeGrowth + row['SIPP Growth'];
    row['SIPP AMC Charge'] = row['SIPP + Growth'] * sippAmcDecimal;
    row['SIPP Minus AMC'] = row['SIPP + Growth'] - row['SIPP AMC Charge'];


    row['ISA Growth'] = row['ISA Initial'] * isaGrowthDecimal;
    row['ISA Value Before Withdrawal'] = row['ISA Initial'] + row['ISA Growth'];
    row['GIA Growth'] = row['GIA Initial'] * giaGrowthDecimal;
    row['GIA Value Before Withdrawal'] = row['GIA Initial'] + row['GIA Growth'];

    // --- DB Pension Calculation (Refactored) ---
    if (initialDbPensionAmount > 0 && age >= dbPensionStartAge) {
      // Calculate directly from initial amount, inflating from start age to current age.
      row['DB Pension'] = initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge);
    } else {
      row['DB Pension'] = 0;
    }

    // --- State Pension Calculation (Refactored) ---
    if (initialStatePensionAmount > 0 && age >= statePensionAge) {
        // Calculate directly from initial amount, inflating from start age to current age.
        row['State Pension'] = initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge);
    } else {
        row['State Pension'] = 0;
    }


    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);
    
    let { dcDrawdown, sippDrawdown, cashWithdrawal, isaWithdrawal, giaWithdrawal, calculatedNet, taxPaid, incomeSubjectToTax, totalGrossIncome } = 
      calculateDrawdownsForNetTarget(
        inflatedTargetNetIncome,
        row['DB Pension'] || 0,
        row['State Pension'] || 0,
        row['DC Minus AMC'], 
        dcUfplsTaxFreePortion,
        row['SIPP Minus AMC'],
        sippUfplsTaxFreePortion,
        row['Cash Savings Initial'],
        row['ISA Value Before Withdrawal'],
        row['GIA Value Before Withdrawal'],
        currentPersonalAllowance
      );
    
    let finalDcDrawdown = dcDrawdown;
    let finalSippDrawdown = sippDrawdown;
    let finalCashWithdrawal = cashWithdrawal;
    let finalIsaWithdrawal = isaWithdrawal;
    let finalGiaWithdrawal = giaWithdrawal;

    // Standard percentage withdrawal post-SPA if higher or if target met by other means
    if (age >= statePensionAge) {
      const dcDrawdownByRate = row['DC Minus AMC'] * dcWithdrawDecimal;
      if (dcDrawdownByRate > finalDcDrawdown) {
        finalDcDrawdown = dcDrawdownByRate;
      }

      const sippDrawdownByRate = row['SIPP Minus AMC'] * sippWithdrawDecimal;
      if (sippDrawdownByRate > finalSippDrawdown) {
        finalSippDrawdown = sippDrawdownByRate;
      }
    }
    
    // Recalculate tax and net income with potentially adjusted finalDcDrawdown and finalSippDrawdown
    const taxableDCDrawdownFinal = finalDcDrawdown * (1 - dcUfplsTaxFreePortion);
    const taxableSippDrawdownFinal = finalSippDrawdown * (1 - sippUfplsTaxFreePortion);
    const taxableBaseIncomeFinal = (row['DB Pension'] || 0) + (row['State Pension'] || 0) + taxableDCDrawdownFinal + taxableSippDrawdownFinal;
    row['Income Subject to Tax'] = Math.max(0, taxableBaseIncomeFinal - currentPersonalAllowance);
    row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;
    
    // Recalculate savings withdrawal if pension drawdowns changed due to standard rates
    // This logic ensures savings are only used if necessary after the potentially higher pension drawdowns.
    let netFromPensionsFinal = ((row['DB Pension'] || 0) + (row['State Pension'] || 0) + finalDcDrawdown + finalSippDrawdown) - row['Income Tax Paid'];
    let shortfallAfterPensionsFinal = inflatedTargetNetIncome - netFromPensionsFinal;

    finalCashWithdrawal = 0;
    finalIsaWithdrawal = 0;
    finalGiaWithdrawal = 0;

    if (shortfallAfterPensionsFinal > 0) {
        finalCashWithdrawal = Math.min(shortfallAfterPensionsFinal, row['Cash Savings Initial']);
        shortfallAfterPensionsFinal -= finalCashWithdrawal;
    }
    if (shortfallAfterPensionsFinal > 0) {
        finalIsaWithdrawal = Math.min(shortfallAfterPensionsFinal, row['ISA Value Before Withdrawal']);
        shortfallAfterPensionsFinal -= finalIsaWithdrawal;
    }
    if (shortfallAfterPensionsFinal > 0) {
        finalGiaWithdrawal = Math.min(shortfallAfterPensionsFinal, row['GIA Value Before Withdrawal']);
    }

    row['DC Pension Drawdown'] = Math.max(0, Math.min(finalDcDrawdown, row['DC Minus AMC']));
    row['SIPP Drawdown'] = Math.max(0, Math.min(finalSippDrawdown, row['SIPP Minus AMC']));
    
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
    row['SIPP Balance'] = row['SIPP Minus AMC'] - row['SIPP Drawdown'];
    row['SIPP Balance'] = Math.max(0, row['SIPP Balance']);
    
    row['TOTAL INCOME'] = (row['DB Pension'] || 0) + (row['State Pension'] || 0) + row['DC Pension Drawdown'] + row['SIPP Drawdown'] + row['Total Savings Withdrawn']; 
    row['Net Income Per Year'] = row['TOTAL INCOME'] - row['Income Tax Paid'];
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
