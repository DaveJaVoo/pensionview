
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

  if (projectionEndAge <= currentAge) {
    throw new Error('Projection End Age must be greater than Current Age.');
  }

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
  const dcUfplsTaxFreePortion = takeTaxFreeLumpSum ? 0 : UFPLS_TAX_FREE_PORTION;

  if (takeTaxFreeLumpSum) {
    taxFreeLumpSumTakenAmount = totalInitialDcPensionValue * 0.25;
    actualInitialDcPensionForProjection = totalInitialDcPensionValue * 0.75;
  }

  let actualInitialSippForProjection = totalInitialSippValue;
  let sippTaxFreeLumpSumTakenAmount = 0;
  const sippUfplsTaxFreePortion = takeSippTaxFreeLumpSum ? 0 : UFPLS_TAX_FREE_PORTION;

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

    // --- POT CALCULATIONS ---
    let dcPotForDrawdown = 0;
    let dcGrowth = 0;
    let dcPotAfterGrowth = 0;
    let dcAmcCharge = 0;
    let dcContributionThisYear = 0;
    let initialDcPension = 0;

    if (showDcPension) {
        initialDcPension = previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection;
        dcContributionThisYear = (age >= dcContributionStartAge && age < dcContributionEndAge && annualDcPensionContribution > 0) ? annualDcPensionContribution : 0;
        initialDcPension += dcContributionThisYear;
        dcGrowth = initialDcPension * invGrowthDecimal;
        dcPotAfterGrowth = initialDcPension + dcGrowth;
        dcAmcCharge = dcPotAfterGrowth * amcDecimal;
        dcPotForDrawdown = dcPotAfterGrowth - dcAmcCharge;
    }

    let sippPotForDrawdown = 0;
    let sippGrowth = 0;
    let sippPotAfterGrowth = 0;
    let sippAmcCharge = 0;
    let sippContributionThisYear = 0;
    let initialSipp = 0;

    if (showSipp) {
        initialSipp = previousRow ? (previousRow['SIPP Balance'] || 0) : actualInitialSippForProjection;
        sippContributionThisYear = (age >= sippContributionStartAge && age < sippContributionEndAge && annualSippContribution > 0) ? annualSippContribution : 0;
        initialSipp += sippContributionThisYear;
        sippGrowth = initialSipp * sippInvGrowthDecimal;
        sippPotAfterGrowth = initialSipp + sippGrowth;
        sippAmcCharge = sippPotAfterGrowth * sippAmcDecimal;
        sippPotForDrawdown = sippPotAfterGrowth - sippAmcCharge;
    }

    const initialCash = showCash ? (previousRow ? (previousRow['Cash Savings Balance'] || 0) : initialCashSavings) : 0;
    const isaGrowth = (previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount) * isaGrowthDecimal;
    const isaValueBeforeWithdrawal = (previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount) + isaGrowth;
    const giaGrowth = (previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount) * giaGrowthDecimal;
    const giaValueBeforeWithdrawal = (previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount) + giaGrowth;

    // --- WITHDRAWAL LOGIC ---
    let dcDrawdown = 0;
    let sippDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = (initialOtherIncome > 0) ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    const fasThisYear = (initialFasAmount > 0 && age >= fasStartAge) ? initialFasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;
    
    const fixedTaxableIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + fasThisYear;
    const taxOnFixedIncome = Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
    const netFromFixedIncome = fixedTaxableIncome - taxOnFixedIncome;

    let netShortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);
    let runningTaxableIncome = fixedTaxableIncome;

    // STEP 1: USE PENSION TO FILL PERSONAL ALLOWANCE
    if (netShortfall > 0) {
      let paRoom = Math.max(0, currentPersonalAllowance - runningTaxableIncome);
      if (paRoom > 0) {
        // From DC
        if ((dcPotForDrawdown - dcDrawdown) > 0) {
          const taxablePortionOfDraw = 1 - dcUfplsTaxFreePortion;
          const grossNeededToFillPa = taxablePortionOfDraw > 0 ? paRoom / taxablePortionOfDraw : paRoom;
          const netFromThisDraw = grossNeededToFillPa;
          const draw = Math.min(dcPotForDrawdown - dcDrawdown, grossNeededToFillPa, netFromThisDraw > netShortfall ? (netShortfall / (1 - (taxablePortionOfDraw * (fixedTaxableIncome > currentPersonalAllowance ? INCOME_TAX_RATE : 0) ) )) : Infinity, netShortfall);
          dcDrawdown += draw;
          runningTaxableIncome += draw * taxablePortionOfDraw;
          netShortfall -= draw;
        }
        // From SIPP
        paRoom = Math.max(0, currentPersonalAllowance - runningTaxableIncome);
        if (netShortfall > 0 && paRoom > 0 && (sippPotForDrawdown - sippDrawdown) > 0) {
          const taxablePortionOfDraw = 1 - sippUfplsTaxFreePortion;
          const grossNeededToFillPa = taxablePortionOfDraw > 0 ? paRoom / taxablePortionOfDraw : paRoom;
          const netFromThisDraw = grossNeededToFillPa;
          const draw = Math.min(sippPotForDrawdown - sippDrawdown, grossNeededToFillPa, netFromThisDraw > netShortfall ? (netShortfall / (1 - (taxablePortionOfDraw * (fixedTaxableIncome > currentPersonalAllowance ? INCOME_TAX_RATE : 0) ) )) : Infinity, netShortfall);
          sippDrawdown += draw;
          runningTaxableIncome += draw * taxablePortionOfDraw;
          netShortfall -= draw;
        }
      }
    }

    // STEP 2: USE SAVINGS
    if (netShortfall > 0) {
        const cashToTake = Math.min(initialCash, netShortfall);
        cashWithdrawal += cashToTake;
        netShortfall -= cashToTake;
    }
    if (netShortfall > 0) {
        const isaToTake = Math.min(isaValueBeforeWithdrawal, netShortfall);
        isaWithdrawal += isaToTake;
        netShortfall -= isaToTake;
    }
    if (netShortfall > 0) {
        const giaToTake = Math.min(giaValueBeforeWithdrawal, netShortfall);
        giaWithdrawal += giaToTake;
        netShortfall -= giaToTake;
    }

    // STEP 3: USE PENSION TAXABLY
    if (netShortfall > 0) {
        // From DC
        if ((dcPotForDrawdown - dcDrawdown) > 0) {
            const netPerGross = 1 - (INCOME_TAX_RATE * (1 - dcUfplsTaxFreePortion));
            if (netPerGross > 0) {
                const grossNeeded = netShortfall / netPerGross;
                const draw = Math.min(dcPotForDrawdown - dcDrawdown, grossNeeded);
                dcDrawdown += draw;
                runningTaxableIncome += draw * (1 - dcUfplsTaxFreePortion);
                netShortfall -= draw * netPerGross;
            }
        }
        // From SIPP
        if (netShortfall > 0 && (sippPotForDrawdown - sippDrawdown) > 0) {
            const netPerGross = 1 - (INCOME_TAX_RATE * (1 - sippUfplsTaxFreePortion));
            if (netPerGross > 0) {
                const grossNeeded = netShortfall / netPerGross;
                const draw = Math.min(sippPotForDrawdown - sippDrawdown, grossNeeded);
                sippDrawdown += draw;
                runningTaxableIncome += draw * (1 - sippUfplsTaxFreePortion);
                netShortfall -= draw * netPerGross;
            }
        }
    }

    // STEP 4: APPLY MINIMUM WITHDRAWAL RATE (ADDITIVE)
    if (age >= statePensionAge) {
      const dcStandardWithdrawal = dcPotForDrawdown * dcWithdrawDecimal;
      if (dcStandardWithdrawal > dcDrawdown) {
          const additionalDraw = dcStandardWithdrawal - dcDrawdown;
          dcDrawdown += additionalDraw;
          runningTaxableIncome += additionalDraw * (1 - dcUfplsTaxFreePortion);
      }
      const sippStandardWithdrawal = sippPotForDrawdown * sippWithdrawDecimal;
      if (sippStandardWithdrawal > sippDrawdown) {
          const additionalDraw = sippStandardWithdrawal - sippDrawdown;
          sippDrawdown += additionalDraw;
          runningTaxableIncome += additionalDraw * (1 - sippUfplsTaxFreePortion);
      }
    }
    
    // --- FINAL TALLY ---
    const finalTotalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const finalTotalGrossIncome = fixedTaxableIncome + dcDrawdown + sippDrawdown + finalTotalSavingsWithdrawn;
    const finalTaxPaid = Math.max(0, runningTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
    const finalNetIncome = finalTotalGrossIncome - finalTaxPaid;
    
    row['TOTAL INCOME'] = finalTotalGrossIncome;
    row['Income Subject to Tax'] = Math.max(0, runningTaxableIncome - currentPersonalAllowance);
    row['Income Tax Paid'] = finalTaxPaid;
    row['Net Income Per Year'] = finalNetIncome;
    row['Net Income Per Month'] = finalNetIncome / 12;

    const finalDcBalance = dcPotForDrawdown - dcDrawdown;
    const finalSippBalance = sippPotForDrawdown - sippDrawdown;
    const finalCashBalance = initialCash - cashWithdrawal;
    const finalIsaBalance = isaValueBeforeWithdrawal - isaWithdrawal;
    const finalGiaBalance = giaValueBeforeWithdrawal - giaWithdrawal;
    
    if (showDcPension) {
      Object.assign(row, { 'Initial DC Pension': initialDcPension });
      if (params.annualDcPensionContribution > 0) {
        row['DC Pension Contribution'] = dcContributionThisYear;
      }
      Object.assign(row, {
        'DC Pension Growth': dcGrowth, 'DC Pension + Growth': dcPotAfterGrowth,
        'DC AMC Charge': dcAmcCharge, 'DC Minus AMC': dcPotForDrawdown,
        'DC Pension Drawdown': dcDrawdown, 'DC Pension Balance': finalDcBalance
      });
    }

    if (showSipp) {
        Object.assign(row, { 'Initial SIPP': initialSipp });
        if(params.annualSippContribution > 0) {
            row['SIPP Contribution'] = sippContributionThisYear;
        }
        Object.assign(row, {
            'SIPP Growth': sippGrowth, 'SIPP + Growth': sippPotAfterGrowth,
            'SIPP AMC Charge': sippAmcCharge, 'SIPP Minus AMC': sippPotForDrawdown,
            'SIPP Drawdown': sippDrawdown, 'SIPP Balance': finalSippBalance
        });
    }

    if (params.initialDbPensionAmount > 0) row['DB Pension'] = dbPensionThisYear;
    if (params.initialStatePensionAmount > 0) row['State Pension'] = statePensionThisYear;
    if (params.initialOtherIncome > 0) row['Other Income'] = otherIncomeThisYear;
    if (params.initialFasAmount > 0) row['FAS'] = fasThisYear;
    
    if (showCash) Object.assign(row, { 'Cash Savings Initial': initialCash, 'Withdraw from Cash': cashWithdrawal, 'Cash Savings Balance': finalCashBalance });
    if (showIsa) Object.assign(row, { 'ISA Initial': (previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount), 'ISA Growth': isaGrowth, 'ISA Value Before Withdrawal': isaValueBeforeWithdrawal, 'Withdraw from ISA': isaWithdrawal, 'ISA Balance': finalIsaBalance });
    if (showGia) Object.assign(row, { 'GIA Initial': (previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount), 'GIA Growth': giaGrowth, 'GIA Value Before Withdrawal': giaValueBeforeWithdrawal, 'Withdraw from GIA': giaWithdrawal, 'GIA Balance': finalGiaBalance });
    
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
