
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
  let dcUfplsTaxFreePortion = UFPLS_TAX_FREE_PORTION;

  if (takeTaxFreeLumpSum) {
    taxFreeLumpSumTakenAmount = totalInitialDcPensionValue * 0.25;
    actualInitialDcPensionForProjection = totalInitialDcPensionValue * 0.75;
    dcUfplsTaxFreePortion = 0;
  }

  let actualInitialSippForProjection = totalInitialSippValue;
  let sippTaxFreeLumpSumTakenAmount = 0;
  let sippUfplsTaxFreePortion = UFPLS_TAX_FREE_PORTION;

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
  
  const usePcls = takeTaxFreeLumpSum || takeSippTaxFreeLumpSum;
  const withdrawalStrategy = usePcls ? 'savingsFirst' : 'pensionFirst';


  for (let age = currentAge; age <= projectionEndAge; age++) {
    const yearOffset = age - currentAge;
    const currentYearStr = (projectionStartYear + yearOffset).toString();
    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);
    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);

    const row: PensionDataRow = { Age: age, Year: currentYearStr, 'TOTAL INCOME': 0, 'Income Subject to Tax': 0, 'Income Tax Paid': 0, 'Net Income Per Year': 0, 'Net Income Per Month': 0 };

    let initialDCPension = previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection;
    const dcContributionThisYear = (age >= dcContributionStartAge && age < dcContributionEndAge && annualDcPensionContribution > 0) ? annualDcPensionContribution : 0;
    initialDCPension += dcContributionThisYear;
    const dcGrowth = initialDCPension * invGrowthDecimal;
    const dcPotAfterGrowth = initialDCPension + dcGrowth;
    const dcAmcCharge = dcPotAfterGrowth * amcDecimal;
    let dcPotForDrawdown = dcPotAfterGrowth - dcAmcCharge;

    let initialSipp = previousRow ? (previousRow['SIPP Balance'] || 0) : actualInitialSippForProjection;
    const sippContributionThisYear = (age >= sippContributionStartAge && age < sippContributionEndAge && annualSippContribution > 0) ? annualSippContribution : 0;
    initialSipp += sippContributionThisYear;
    const sippGrowth = initialSipp * sippInvGrowthDecimal;
    const sippPotAfterGrowth = initialSipp + sippGrowth;
    const sippAmcCharge = sippPotAfterGrowth * sippAmcDecimal;
    let sippPotForDrawdown = sippPotAfterGrowth - sippAmcCharge;

    let initialCash = showCash ? (previousRow ? (previousRow['Cash Savings Balance'] || 0) : initialCashSavings) : 0;
    let initialIsa = showIsa ? (previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount) : 0;
    const isaGrowth = initialIsa * isaGrowthDecimal;
    let isaValueBeforeWithdrawal = initialIsa + isaGrowth;
    let initialGia = showGia ? (previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount) : 0;
    const giaGrowth = initialGia * giaGrowthDecimal;
    let giaValueBeforeWithdrawal = initialGia + giaGrowth;

    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = (initialOtherIncome > 0) ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    const fasThisYear = (initialFasAmount > 0 && age >= fasStartAge) ? initialFasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;
    
    let dcDrawdown = 0;
    let sippDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;
    
    const fixedGrossTaxableIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + fasThisYear;
    const taxOnFixedIncome = Math.max(0, fixedGrossTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
    const netFromFixedIncome = fixedGrossTaxableIncome - taxOnFixedIncome;

    let shortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);
    
    const takeTaxablePension = (shortfallToCover: number) => {
        let netFromTaxablePension = 0;
        
        let dcNetPerGross = (1 - INCOME_TAX_RATE * (1 - dcUfplsTaxFreePortion));
        if (dcNetPerGross > 0 && shortfallToCover > 0) {
            const dcGrossNeeded = shortfallToCover / dcNetPerGross;
            const canTake = Math.min(dcPotForDrawdown, dcGrossNeeded);
            dcDrawdown += canTake;
            dcPotForDrawdown -= canTake;
            const netFromThis = canTake * dcNetPerGross;
            netFromTaxablePension += netFromThis;
            shortfallToCover -= netFromThis;
        }

        if (shortfallToCover > 0) {
            let sippNetPerGross = (1 - INCOME_TAX_RATE * (1 - sippUfplsTaxFreePortion));
            if (sippNetPerGross > 0) {
                const sippGrossNeeded = shortfallToCover / sippNetPerGross;
                const canTake = Math.min(sippPotForDrawdown, sippGrossNeeded);
                sippDrawdown += canTake;
                sippPotForDrawdown -= canTake;
                const netFromThis = canTake * sippNetPerGross;
                netFromTaxablePension += netFromThis;
            }
        }
        return netFromTaxablePension;
    };

    const takeFromSavings = (shortfallToCover: number) => {
        let netFromSavings = 0;
        const takeCash = Math.min(shortfallToCover, initialCash);
        cashWithdrawal += takeCash;
        initialCash -= takeCash;
        netFromSavings += takeCash;
        shortfallToCover -= takeCash;

        if (shortfallToCover > 0) {
            const takeIsa = Math.min(shortfallToCover, isaValueBeforeWithdrawal);
            isaWithdrawal += takeIsa;
            isaValueBeforeWithdrawal -= takeIsa;
            netFromSavings += takeIsa;
            shortfallToCover -= takeIsa;
        }
        if (shortfallToCover > 0) {
            const takeGia = Math.min(shortfallToCover, giaValueBeforeWithdrawal);
            giaWithdrawal += takeGia;
            giaValueBeforeWithdrawal -= takeGia;
            netFromSavings += takeGia;
        }
        return netFromSavings;
    };

    if (withdrawalStrategy === 'pensionFirst') {
        if (shortfall > 0) {
            shortfall -= takeTaxablePension(shortfall);
        }
        if (shortfall > 0) {
            shortfall -= takeFromSavings(shortfall);
        }
    } else { // 'savingsFirst'
        const remainingPersonalAllowance = Math.max(0, currentPersonalAllowance - fixedGrossTaxableIncome);
        if (remainingPersonalAllowance > 0 && shortfall > 0) {
            // Gross to take to fill PA = PA / (1-TFP)
            const dcGrossToFillPa = (dcUfplsTaxFreePortion < 1) ? remainingPersonalAllowance / (1 - dcUfplsTaxFreePortion) : Infinity;
            let dcToTake = Math.min(dcPotForDrawdown, dcGrossToFillPa);
            let netFromDc = dcToTake; // It's all tax-free since it's within the PA

            if (netFromDc > shortfall) {
                dcToTake = shortfall;
            }
            dcDrawdown += dcToTake;
            dcPotForDrawdown -= dcToTake;
            shortfall -= dcToTake;

            const taxableIncomeFromDc = dcToTake * (1 - dcUfplsTaxFreePortion);
            const paAfterDc = remainingPersonalAllowance - taxableIncomeFromDc;

            if (paAfterDc > 0 && shortfall > 0) {
                const sippGrossToFillPa = (sippUfplsTaxFreePortion < 1) ? paAfterDc / (1 - sippUfplsTaxFreePortion) : Infinity;
                let sippToTake = Math.min(sippPotForDrawdown, sippGrossToFillPa);
                let netFromSipp = sippToTake;

                if (netFromSipp > shortfall) {
                    sippToTake = shortfall;
                }
                sippDrawdown += sippToTake;
                sippPotForDrawdown -= sippToTake;
                shortfall -= sippToTake;
            }
        }

        if (shortfall > 0) {
            shortfall -= takeFromSavings(shortfall);
        }
        
        if (shortfall > 0) {
            shortfall -= takeTaxablePension(shortfall);
        }
    }

    let finalDcDrawdown = dcDrawdown;
    let finalSippDrawdown = sippDrawdown;
    
    if (age >= statePensionAge) {
      const dcStandardWithdrawal = (initialDCPension + dcContributionThisYear) * dcWithdrawDecimal;
      if (dcStandardWithdrawal > finalDcDrawdown) {
          const extraDrawdown = dcStandardWithdrawal - finalDcDrawdown;
          const availableFromDc = dcPotForDrawdown;
          finalDcDrawdown += Math.min(extraDrawdown, availableFromDc);
          dcPotForDrawdown -= Math.min(extraDrawdown, availableFromDc);
      }
      
      const sippStandardWithdrawal = (initialSipp + sippContributionThisYear) * sippWithdrawDecimal;
      if (sippStandardWithdrawal > finalSippDrawdown) {
          const extraDrawdown = sippStandardWithdrawal - finalSippDrawdown;
          const availableFromSipp = sippPotForDrawdown;
          finalSippDrawdown += Math.min(extraDrawdown, availableFromSipp);
          sippPotForDrawdown -= Math.min(extraDrawdown, availableFromSipp);
      }
    }
    
    const totalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const taxableDCDrawdownFinal = finalDcDrawdown * (1 - dcUfplsTaxFreePortion);
    const taxableSippDrawdownFinal = finalSippDrawdown * (1 - sippUfplsTaxFreePortion);
    
    const totalGrossTaxableIncome = fixedGrossTaxableIncome + taxableDCDrawdownFinal + taxableSippDrawdownFinal;
    
    row['Income Subject to Tax'] = Math.max(0, totalGrossTaxableIncome - currentPersonalAllowance);
    row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;
    const grossIncomeFromSources = fixedGrossTaxableIncome + finalDcDrawdown + finalSippDrawdown + totalSavingsWithdrawn;
    row['TOTAL INCOME'] = grossIncomeFromSources;
    row['Net Income Per Year'] = grossIncomeFromSources - row['Income Tax Paid'];
    row['Net Income Per Month'] = row['Net Income Per Year'] / 12;

    const finalCashBalance = initialCash;
    const finalIsaBalance = isaValueBeforeWithdrawal;
    const finalGiaBalance = giaValueBeforeWithdrawal;
    row['DC Pension Balance'] = Math.max(0, dcPotForDrawdown);
    row['SIPP Balance'] = Math.max(0, sippPotForDrawdown);

    if (showDcPension) {
      Object.assign(row, { 'Initial DC Pension': (previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection) });
      if (params.annualDcPensionContribution > 0) {
        row['DC Pension Contribution'] = dcContributionThisYear;
      }
      Object.assign(row, {
        'DC Pension Growth': dcGrowth, 'DC Pension + Growth': dcPotAfterGrowth,
        'DC AMC Charge': dcAmcCharge, 'DC Minus AMC': dcPotAfterGrowth - dcAmcCharge,
        'DC Pension Drawdown': finalDcDrawdown
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
            'SIPP Drawdown': finalSippDrawdown
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
      Object.assign(row, { 'Total Savings Withdrawn': totalSavingsWithdrawn, 'Total Savings Balance': finalCashBalance + finalIsaBalance + finalGiaBalance});
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
