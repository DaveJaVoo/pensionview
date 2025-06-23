
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION as GENERAL_UFPLS_TAX_FREE_PORTION } from './types';

function calculateDrawdownsForNetTarget(
  targetNetIncomeThisYear: number,
  dbPensionThisYear: number,
  statePensionThisYear: number,
  otherIncomeThisYear: number,
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
    const grossPensionIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + tempDcDrawdown + tempSippDrawdown;
    
    const taxableBaseIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + taxableDCDrawdown + taxableSippDrawdown;
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

  const finalGrossPensionIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + bestGuess.dcDrawdown + bestGuess.sippDrawdown;
  const finalTaxableBaseIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + finalTaxableDCDrawdown + finalTaxableSippDrawdown;
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
    initialOtherIncome,
    
    initialDcPensionValue: totalInitialDcPensionValue,
    annualDcPensionContribution, dcContributionStartAge, dcContributionEndAge,
    investmentPercentageGrowth, dcWithdrawalRate, annualChargeAMC, takeTaxFreeLumpSum,

    initialSippValue: totalInitialSippValue,
    annualSippContribution, sippContributionStartAge, sippContributionEndAge,
    sippInvestmentPercentageGrowth, sippWithdrawalRate, sippAnnualChargeAMC, takeSippTaxFreeLumpSum,
    
    inflationRate,
    initialCashSavings, initialIsaAmount, isaGrowthRate, initialGiaAmount, giaGrowthRate
  } = params;

  const dynamicHeaders = [
    'Age', 'Year',
    'Initial DC Pension', 'DC Pension Contribution', 'DC Pension Growth', 'DC Pension + Growth',
    'DC AMC Charge', 'DC Minus AMC', 'DC Pension Drawdown', 'DC Pension Balance',
  ];

  if (params.initialSippValue > 0 || params.annualSippContribution > 0) {
    dynamicHeaders.push(
      'Initial SIPP', 'SIPP Contribution', 'SIPP Growth', 'SIPP + Growth',
      'SIPP AMC Charge', 'SIPP Minus AMC', 'SIPP Drawdown', 'SIPP Balance'
    );
  }

  if (params.initialDbPensionAmount > 0) {
    dynamicHeaders.push('DB Pension');
  }
  if (params.initialStatePensionAmount > 0) {
    dynamicHeaders.push('State Pension');
  }
  if (params.initialOtherIncome > 0) {
    dynamicHeaders.push('Other Income');
  }

  const showCash = params.initialCashSavings > 0;
  const showIsa = params.initialIsaAmount > 0;
  const showGia = params.initialGiaAmount > 0;

  if (showCash) {
    dynamicHeaders.push('Cash Savings Initial', 'Withdraw from Cash', 'Cash Savings Balance');
  }
  if (showIsa) {
    dynamicHeaders.push('ISA Initial', 'ISA Growth', 'ISA Value Before Withdrawal', 'Withdraw from ISA', 'ISA Balance');
  }
  if (showGia) {
    dynamicHeaders.push('GIA Initial', 'GIA Growth', 'GIA Value Before Withdrawal', 'Withdraw from GIA', 'GIA Balance');
  }

  if (showCash || showIsa || showGia) {
    dynamicHeaders.push('Total Savings Withdrawn', 'Total Savings Balance');
  }

  dynamicHeaders.push(
    'TOTAL INCOME', 'Income Subject to Tax', 'Income Tax Paid',
    'Net Income Per Year', 'Net Income Per Month'
  );

  const rows: PensionDataRow[] = [];
  let previousRow: PensionDataRow | null = null;
  
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
    
    if (params.initialSippValue > 0 || params.annualSippContribution > 0) {
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
    }

    if (showIsa) {
        row['ISA Initial'] = previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount;
        row['ISA Growth'] = row['ISA Initial'] * isaGrowthDecimal;
        row['ISA Value Before Withdrawal'] = row['ISA Initial'] + row['ISA Growth'];
    }
    if (showGia) {
        row['GIA Initial'] = previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount;
        row['GIA Growth'] = row['GIA Initial'] * giaGrowthDecimal;
        row['GIA Value Before Withdrawal'] = row['GIA Initial'] + row['GIA Growth'];
    }
    if (showCash) {
        row['Cash Savings Initial'] = previousRow ? (previousRow['Cash Savings Balance'] || 0) : initialCashSavings;
    }

    if (initialDbPensionAmount > 0) {
      row['DB Pension'] = age >= dbPensionStartAge ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    }
    if (initialStatePensionAmount > 0) {
        row['State Pension'] = age >= statePensionAge ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    }
    if (initialOtherIncome > 0) {
        row['Other Income'] = initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset);
    }


    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);
    
    let { dcDrawdown, sippDrawdown, cashWithdrawal, isaWithdrawal, giaWithdrawal } = 
      calculateDrawdownsForNetTarget(
        inflatedTargetNetIncome,
        row['DB Pension'] || 0,
        row['State Pension'] || 0,
        row['Other Income'] || 0,
        row['DC Minus AMC'], 
        dcUfplsTaxFreePortion,
        row['SIPP Minus AMC'] || 0,
        sippUfplsTaxFreePortion,
        row['Cash Savings Initial'] || 0,
        row['ISA Value Before Withdrawal'] || 0,
        row['GIA Value Before Withdrawal'] || 0,
        currentPersonalAllowance
      );
    
    let finalDcDrawdown = dcDrawdown;
    let finalSippDrawdown = sippDrawdown;

    if (age >= statePensionAge) {
      const dcDrawdownByRate = row['DC Minus AMC'] * dcWithdrawDecimal;
      if (dcDrawdownByRate > finalDcDrawdown) {
        finalDcDrawdown = dcDrawdownByRate;
      }

      const sippDrawdownByRate = (row['SIPP Minus AMC'] || 0) * sippWithdrawDecimal;
      if (sippDrawdownByRate > finalSippDrawdown) {
        finalSippDrawdown = sippDrawdownByRate;
      }
    }
    
    const taxableDCDrawdownFinal = finalDcDrawdown * (1 - dcUfplsTaxFreePortion);
    const taxableSippDrawdownFinal = finalSippDrawdown * (1 - sippUfplsTaxFreePortion);
    const taxableBaseIncomeFinal = (row['DB Pension'] || 0) + (row['State Pension'] || 0) + (row['Other Income'] || 0) + taxableDCDrawdownFinal + taxableSippDrawdownFinal;
    row['Income Subject to Tax'] = Math.max(0, taxableBaseIncomeFinal - currentPersonalAllowance);
    row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;
    
    row['DC Pension Drawdown'] = Math.max(0, Math.min(finalDcDrawdown, row['DC Minus AMC']));
    row['SIPP Drawdown'] = Math.max(0, Math.min(finalSippDrawdown, row['SIPP Minus AMC'] || 0));
    
    if (showCash) {
        row['Withdraw from Cash'] = Math.min(cashWithdrawal, row['Cash Savings Initial'] || 0);
        row['Cash Savings Balance'] = (row['Cash Savings Initial'] || 0) - (row['Withdraw from Cash'] || 0);
    }
    if (showIsa) {
        row['Withdraw from ISA'] = Math.min(isaWithdrawal, row['ISA Value Before Withdrawal'] || 0);
        row['ISA Balance'] = (row['ISA Value Before Withdrawal'] || 0) - (row['Withdraw from ISA'] || 0);
    }
    if (showGia) {
        row['Withdraw from GIA'] = Math.min(giaWithdrawal, row['GIA Value Before Withdrawal'] || 0);
        row['GIA Balance'] = (row['GIA Value Before Withdrawal'] || 0) - (row['Withdraw from GIA'] || 0);
    }

    if (showCash || showIsa || showGia) {
        row['Total Savings Withdrawn'] = (row['Withdraw from Cash'] || 0) + (row['Withdraw from ISA'] || 0) + (row['Withdraw from GIA'] || 0);
        row['Total Savings Balance'] = (row['Cash Savings Balance'] || 0) + (row['ISA Balance'] || 0) + (row['GIA Balance'] || 0);
    }
    
    row['DC Pension Balance'] = row['DC Minus AMC'] - row['DC Pension Drawdown'];
    row['DC Pension Balance'] = Math.max(0, row['DC Pension Balance']);
    if (params.initialSippValue > 0 || params.annualSippContribution > 0) {
        row['SIPP Balance'] = (row['SIPP Minus AMC'] || 0) - (row['SIPP Drawdown'] || 0);
        row['SIPP Balance'] = Math.max(0, row['SIPP Balance'] || 0);
    }
    
    row['TOTAL INCOME'] = (row['DB Pension'] || 0) + (row['State Pension'] || 0) + (row['Other Income'] || 0) + row['DC Pension Drawdown'] + (row['SIPP Drawdown'] || 0) + (row['Total Savings Withdrawn'] || 0); 
    row['Net Income Per Year'] = row['TOTAL INCOME'] - row['Income Tax Paid'];
    row['Net Income Per Month'] = row['Net Income Per Year'] / 12;

    dynamicHeaders.forEach(header => {
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

  const csvHeaderString = dynamicHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
  const csvRowStrings = rows.map(r => {
    return dynamicHeaders.map(header => {
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

  return { rows, headers: dynamicHeaders, parameters: outputParameters, csvString };
}
