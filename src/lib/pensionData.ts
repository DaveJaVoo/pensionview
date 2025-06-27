
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';

export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, projectionStartYear, projectionEndAge, targetAnnualNetIncome,
    initialDbPensionAmount, dbPensionStartAge,
    statePensionAge, initialStatePensionAmount,
    initialOtherIncome, initialFasAmount, fasStartAge,
    
    initialDcPensionValue: totalInitialDcPensionValue,
    annualDcPensionContribution, dcContributionStartAge, dcContributionEndAge,
    investmentPercentageGrowth, dcWithdrawalRate, annualChargeAMC, takeTaxFreeLumpSum,

    initialSippValue: totalInitialSippValue,
    annualSippContribution, sippContributionStartAge, sippContributionEndAge,
    sippInvestmentPercentageGrowth, sippWithdrawalRate, sippAnnualChargeAMC, takeSippTaxFreeLumpSum,
    
    inflationRate,
    initialCashSavings, initialIsaAmount, isaGrowthRate, initialGiaAmount, giaGrowthRate
  } = params;

  const headers: string[] = ['Age', 'Year'];
  const showDcPension = params.initialDcPensionValue > 0 || params.annualDcPensionContribution > 0;
  const showSipp = params.initialSippValue > 0 || params.annualSippContribution > 0;

  if (showDcPension) {
      headers.push('Initial DC Pension');
      if (params.annualDcPensionContribution > 0) {
        headers.push('DC Pension Contribution');
      }
      headers.push('DC Pension Growth', 'DC Pension + Growth', 'DC AMC Charge', 'DC Minus AMC', 'DC Pension Drawdown', 'DC Pension Balance');
  }
  if (showSipp) {
      headers.push('Initial SIPP');
      if (params.annualSippContribution > 0) {
          headers.push('SIPP Contribution');
      }
      headers.push('SIPP Growth', 'SIPP + Growth', 'SIPP AMC Charge', 'SIPP Minus AMC', 'SIPP Drawdown', 'SIPP Balance');
  }
  if (params.initialDbPensionAmount > 0) {
      headers.push('DB Pension');
  }
   if (params.initialStatePensionAmount > 0) {
      headers.push('State Pension');
  }
  if (params.initialOtherIncome > 0) {
      headers.push('Other Income');
  }
  if (params.initialFasAmount > 0) {
      headers.push('FAS');
  }
  const showCash = params.initialCashSavings > 0;
  const showIsa = params.initialIsaAmount > 0;
  const showGia = params.initialGiaAmount > 0;
  if (showCash) {
      headers.push('Cash Savings Initial', 'Withdraw from Cash', 'Cash Savings Balance');
  }
  if (showIsa) {
      headers.push('ISA Initial', 'ISA Growth', 'ISA Value Before Withdrawal', 'Withdraw from ISA', 'ISA Balance');
  }
  if (showGia) {
      headers.push('GIA Initial', 'GIA Growth', 'GIA Value Before Withdrawal', 'Withdraw from GIA', 'GIA Balance');
  }
  if (showCash || showIsa || showGia) {
      headers.push('Total Savings Withdrawn', 'Total Savings Balance');
  }
  headers.push('TOTAL INCOME', 'Income Subject to Tax', 'Income Tax Paid', 'Net Income Per Year', 'Net Income Per Month');

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
  let dcUfplsTaxFreePortion = takeTaxFreeLumpSum ? 0 : UFPLS_TAX_FREE_PORTION;

  if (takeTaxFreeLumpSum) {
    taxFreeLumpSumTakenAmount = totalInitialDcPensionValue * 0.25;
    actualInitialDcPensionForProjection = totalInitialDcPensionValue * 0.75;
  }

  let actualInitialSippForProjection = totalInitialSippValue;
  let sippTaxFreeLumpSumTakenAmount = 0;
  let sippUfplsTaxFreePortion = takeSippTaxFreeLumpSum ? 0 : UFPLS_TAX_FREE_PORTION;

  if (takeSippTaxFreeLumpSum) {
    sippTaxFreeLumpSumTakenAmount = totalInitialSippValue * 0.25;
    actualInitialSippForProjection = totalInitialSippValue * 0.75;
  }

  const outputParameters = { 
    ...params, 
    taxFreeLumpSumTaken: taxFreeLumpSumTakenAmount,
    sippTaxFreeLumpSumTaken: sippTaxFreeLumpSumTakenAmount,
  };

  for (let age = currentAge; age <= projectionEndAge; age++) {
    const yearOffset = age - currentAge;
    const currentYearStr = (projectionStartYear + yearOffset).toString();
    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);
    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);

    const row: PensionDataRow = { Age: age, Year: currentYearStr };

    let initialDCPension = previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection;
    const dcContributionThisYear = (age >= dcContributionStartAge && age < dcContributionEndAge && annualDcPensionContribution > 0) ? annualDcPensionContribution : 0;
    initialDCPension += dcContributionThisYear;
    const dcGrowth = initialDCPension * invGrowthDecimal;
    const dcPotAfterGrowth = initialDCPension + dcGrowth;
    const dcAmcCharge = dcPotAfterGrowth * amcDecimal;
    const dcPotForDrawdown = dcPotAfterGrowth - dcAmcCharge;

    let initialSipp = previousRow ? (previousRow['SIPP Balance'] || 0) : actualInitialSippForProjection;
    const sippContributionThisYear = (age >= sippContributionStartAge && age < sippContributionEndAge && annualSippContribution > 0) ? annualSippContribution : 0;
    initialSipp += sippContributionThisYear;
    const sippGrowth = initialSipp * sippInvGrowthDecimal;
    const sippPotAfterGrowth = initialSipp + sippGrowth;
    const sippAmcCharge = sippPotAfterGrowth * sippAmcDecimal;
    const sippPotForDrawdown = sippPotAfterGrowth - sippAmcCharge;

    const initialCash = showCash ? (previousRow ? (previousRow['Cash Savings Balance'] || 0) : initialCashSavings) : 0;
    const initialIsa = showIsa ? (previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount) : 0;
    const isaGrowth = initialIsa * isaGrowthDecimal;
    const isaValueBeforeWithdrawal = initialIsa + isaGrowth;
    const initialGia = showGia ? (previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount) : 0;
    const giaGrowth = initialGia * giaGrowthDecimal;
    const giaValueBeforeWithdrawal = initialGia + giaGrowth;

    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = (initialOtherIncome > 0) ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    const fasThisYear = (initialFasAmount > 0 && age >= fasStartAge) ? initialFasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;

    let dcDrawdown = 0;
    let sippDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    const fixedTaxableIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + fasThisYear;
    const taxOnFixedIncome = Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
    let netIncomeSoFar = fixedTaxableIncome - taxOnFixedIncome;
    let netShortfall = Math.max(0, inflatedTargetNetIncome - netIncomeSoFar);
    let runningTaxableIncome = fixedTaxableIncome;

    const usePensionFirstStrategy = !takeTaxFreeLumpSum;

    const drawOrder = usePensionFirstStrategy 
        ? ['pension', 'savings'] 
        : ['savings', 'pension'];

    for (const source of drawOrder) {
        if (netShortfall <= 0) break;

        if (source === 'pension') {
            const paRoomBeforePensions = Math.max(0, currentPersonalAllowance - runningTaxableIncome);
            if (paRoomBeforePensions > 0) {
                if (dcUfplsTaxFreePortion > 0 && (dcPotForDrawdown - dcDrawdown) > 0) {
                    const grossNeeded = paRoomBeforePensions / (1 - dcUfplsTaxFreePortion);
                    const canTake = Math.min(dcPotForDrawdown - dcDrawdown, grossNeeded);
                    const drawAmount = Math.min(canTake, netShortfall);
                    dcDrawdown += drawAmount;
                    runningTaxableIncome += drawAmount * (1-dcUfplsTaxFreePortion);
                    netShortfall -= drawAmount;
                }
                const paRoomAfterDC = Math.max(0, currentPersonalAllowance - runningTaxableIncome);
                if (paRoomAfterDC > 0 && sippUfplsTaxFreePortion > 0 && (sippPotForDrawdown - sippDrawdown) > 0) {
                    const grossNeeded = paRoomAfterDC / (1 - sippUfplsTaxFreePortion);
                    const canTake = Math.min(sippPotForDrawdown - sippDrawdown, grossNeeded);
                    const drawAmount = Math.min(canTake, netShortfall);
                    sippDrawdown += drawAmount;
                    runningTaxableIncome += drawAmount * (1-sippUfplsTaxFreePortion);
                    netShortfall -= drawAmount;
                }
            }
            if (netShortfall > 0) {
                 if ((dcPotForDrawdown - dcDrawdown) > 0) {
                    const dcNetPerGross = 1 - INCOME_TAX_RATE * (1-dcUfplsTaxFreePortion);
                    const grossNeeded = netShortfall / dcNetPerGross;
                    const canTake = Math.min(dcPotForDrawdown - dcDrawdown, grossNeeded);
                    dcDrawdown += canTake;
                    netShortfall -= canTake * dcNetPerGross;
                 }
                 if (netShortfall > 0 && (sippPotForDrawdown - sippDrawdown) > 0) {
                    const sippNetPerGross = 1 - INCOME_TAX_RATE * (1-sippUfplsTaxFreePortion);
                    const grossNeeded = netShortfall / sippNetPerGross;
                    const canTake = Math.min(sippPotForDrawdown - sippDrawdown, grossNeeded);
                    sippDrawdown += canTake;
                    netShortfall -= canTake * sippNetPerGross;
                 }
            }
        }

        if (source === 'savings') {
            if (netShortfall > 0 && initialCash > 0) {
                const canTake = Math.min(initialCash - cashWithdrawal, netShortfall);
                cashWithdrawal += canTake;
                netShortfall -= canTake;
            }
            if (netShortfall > 0 && isaValueBeforeWithdrawal > 0) {
                const canTake = Math.min(isaValueBeforeWithdrawal - isaWithdrawal, netShortfall);
                isaWithdrawal += canTake;
                netShortfall -= canTake;
            }
            if (netShortfall > 0 && giaValueBeforeWithdrawal > 0) {
                const canTake = Math.min(giaValueBeforeWithdrawal - giaWithdrawal, netShortfall);
                giaWithdrawal += canTake;
                netShortfall -= canTake;
            }
        }
    }

    let finalDcDrawdown = dcDrawdown;
    let finalSippDrawdown = sippDrawdown;
    
    if (age >= statePensionAge) {
      const dcStandardWithdrawal = dcPotForDrawdown * dcWithdrawDecimal;
      if (dcStandardWithdrawal > finalDcDrawdown) {
          finalDcDrawdown = Math.min(dcPotForDrawdown, dcStandardWithdrawal);
      }
      const sippStandardWithdrawal = sippPotForDrawdown * sippWithdrawDecimal;
      if (sippStandardWithdrawal > finalSippDrawdown) {
          finalSippDrawdown = Math.min(sippPotForDrawdown, sippStandardWithdrawal);
      }
    }

    const finalTotalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const finalTaxablePensionIncome = (finalDcDrawdown * (1 - dcUfplsTaxFreePortion)) + (finalSippDrawdown * (1 - sippUfplsTaxFreePortion));
    const finalTotalTaxableIncome = fixedTaxableIncome + finalTaxablePensionIncome;

    const finalTotalGrossIncome = fixedTaxableIncome + finalDcDrawdown + finalSippDrawdown + finalTotalSavingsWithdrawn;
    const finalTaxPaid = Math.max(0, finalTotalTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
    const finalNetIncome = finalTotalGrossIncome - finalTaxPaid;
    
    row['TOTAL INCOME'] = finalTotalGrossIncome;
    row['Income Subject to Tax'] = Math.max(0, finalTotalTaxableIncome - currentPersonalAllowance);
    row['Income Tax Paid'] = finalTaxPaid;
    row['Net Income Per Year'] = finalNetIncome;
    row['Net Income Per Month'] = finalNetIncome / 12;

    const finalDcBalance = dcPotForDrawdown - finalDcDrawdown;
    const finalSippBalance = sippPotForDrawdown - finalSippDrawdown;
    const finalCashBalance = initialCash - cashWithdrawal;
    const finalIsaBalance = isaValueBeforeWithdrawal - isaWithdrawal;
    const finalGiaBalance = giaValueBeforeWithdrawal - giaWithdrawal;
    
    if (showDcPension) {
      Object.assign(row, { 'Initial DC Pension': (previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection) });
      if (params.annualDcPensionContribution > 0) {
        row['DC Pension Contribution'] = dcContributionThisYear;
      }
      Object.assign(row, {
        'DC Pension Growth': dcGrowth, 'DC Pension + Growth': dcPotAfterGrowth,
        'DC AMC Charge': dcAmcCharge, 'DC Minus AMC': dcPotAfterGrowth - dcAmcCharge,
        'DC Pension Drawdown': finalDcDrawdown, 'DC Pension Balance': finalDcBalance
      });
    }

    if (showSipp) {
        Object.assign(row, { 'Initial SIPP': (previousRow ? (previousRow['SIPP Balance'] || 0) : actualInitialSippForProjection) });
        if(params.annualSippContribution > 0) {
            row['SIPP Contribution'] = sippContributionThisYear;
        }
        Object.assign(row, {
            'SIPP Growth': sippGrowth, 'SIPP + Growth': sippPotAfterGrowth,
            'SIPP AMC Charge': sippAmcCharge, 'SIPP Minus AMC': sippPotAfterGrowth - sippAmcCharge,
            'SIPP Drawdown': finalSippDrawdown, 'SIPP Balance': finalSippBalance
        });
    }

    if (params.initialDbPensionAmount > 0) row['DB Pension'] = dbPensionThisYear;
    if (params.initialStatePensionAmount > 0) row['State Pension'] = statePensionThisYear;
    if (params.initialOtherIncome > 0) row['Other Income'] = otherIncomeThisYear;
    if (params.initialFasAmount > 0) row['FAS'] = fasThisYear;
    
    if (showCash) Object.assign(row, { 'Cash Savings Initial': (previousRow ? (previousRow['Cash Savings Balance'] || 0) : initialCashSavings), 'Withdraw from Cash': cashWithdrawal, 'Cash Savings Balance': finalCashBalance });
    if (showIsa) Object.assign(row, { 'ISA Initial': (previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount), 'ISA Growth': isaGrowth, 'ISA Value Before Withdrawal': (previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount) + isaGrowth, 'Withdraw from ISA': isaWithdrawal, 'ISA Balance': finalIsaBalance });
    if (showGia) Object.assign(row, { 'GIA Initial': (previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount), 'GIA Growth': giaGrowth, 'GIA Value Before Withdrawal': (previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount) + giaGrowth, 'Withdraw from GIA': giaWithdrawal, 'GIA Balance': finalGiaBalance });
    
    if(showCash || showIsa || showGia) {
      Object.assign(row, { 'Total Savings Withdrawn': finalTotalSavingsWithdrawn, 'Total Savings Balance': finalCashBalance + finalIsaBalance + finalGiaBalance});
    }

    headers.forEach(header => {
      const val = row[header];
      if (typeof val === 'number') {
        row[header] = parseFloat(val.toFixed(2));
        if (isNaN(row[header] as number)) row[header] = 0;
      }
    });

    rows.push(row);
    previousRow = row;
  }

  const csvHeaderString = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
  const csvRowStrings = rows.map(r => {
    return headers.map(header => {
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

  return { rows, headers, parameters: outputParameters, csvString };
}
