
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

    const fixedTaxableIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + fasThisYear;
    
    // Total income needed to meet target after accounting for fixed income
    // This is a goal, not the final number
    let grossIncomeNeeded = inflatedTargetNetIncome;

    // Waterfall logic to meet income needs
    let totalGrossIncome = fixedTaxableIncome;
    let totalTaxableIncome = fixedTaxableIncome;
    let netIncomeAchieved = 0; // This will be calculated at the end

    // 1. Draw from pensions tax-efficiently up to PA
    let remainingPA = Math.max(0, currentPersonalAllowance - totalTaxableIncome);
    if (remainingPA > 0) {
      // DC
      const grossDcToFillPa = (dcUfplsTaxFreePortion < 1) ? remainingPA / (1 - dcUfplsTaxFreePortion) : Infinity;
      const dcDrawForPa = Math.min(dcPotForDrawdown, grossDcToFillPa);
      dcDrawdown += dcDrawForPa;
      totalGrossIncome += dcDrawForPa;
      totalTaxableIncome += dcDrawForPa * (1 - dcUfplsTaxFreePortion);
      
      remainingPA = Math.max(0, currentPersonalAllowance - totalTaxableIncome);

      // SIPP
      const grossSippToFillPa = (sippUfplsTaxFreePortion < 1) ? remainingPA / (1 - sippUfplsTaxFreePortion) : Infinity;
      const sippDrawForPa = Math.min(sippPotForDrawdown - dcDrawdown, grossSippToFillPa);
      sippDrawdown += sippDrawForPa;
      totalGrossIncome += sippDrawForPa;
      totalTaxableIncome += sippDrawForPa * (1- sippUfplsTaxFreePortion);
    }
    
    // Recalculate net income so far and shortfall
    let currentTax = Math.max(0, totalTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
    netIncomeAchieved = totalGrossIncome - currentTax;
    let netShortfall = Math.max(0, inflatedTargetNetIncome - netIncomeAchieved);

    // 2. Use savings to fill the gap
    if (netShortfall > 0) {
      const drawCash = Math.min(netShortfall, initialCash);
      cashWithdrawal += drawCash;
      netShortfall -= drawCash;
    }
    if (netShortfall > 0) {
      const drawIsa = Math.min(netShortfall, isaValueBeforeWithdrawal);
      isaWithdrawal += drawIsa;
      netShortfall -= drawIsa;
    }
    if (netShortfall > 0) {
      const drawGia = Math.min(netShortfall, giaValueBeforeWithdrawal);
      giaWithdrawal += drawGia;
      netShortfall -= drawGia;
    }

    // 3. Use taxable pension if still short
    if (netShortfall > 0) {
      // DC
      const dcNetPerGross = 1 - INCOME_TAX_RATE * (1 - dcUfplsTaxFreePortion);
      if (dcNetPerGross > 0) {
        const dcGrossNeeded = netShortfall / dcNetPerGross;
        const canTake = Math.min(dcPotForDrawdown - dcDrawdown, dcGrossNeeded);
        dcDrawdown += canTake;
        netShortfall -= canTake * dcNetPerGross;
      }
    }
    if (netShortfall > 0) {
      // SIPP
      const sippNetPerGross = 1 - INCOME_TAX_RATE * (1 - sippUfplsTaxFreePortion);
      if (sippNetPerGross > 0) {
        const sippGrossNeeded = netShortfall / sippNetPerGross;
        const canTake = Math.min(sippPotForDrawdown - sippDrawdown, sippGrossNeeded);
        sippDrawdown += canTake;
        netShortfall -= canTake * sippNetPerGross;
      }
    }

    // 4. Override with standard withdrawal rate post-SPA if higher
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

    // Final calculation for the row
    dcPotForDrawdown -= finalDcDrawdown;
    sippPotForDrawdown -= finalSippDrawdown;
    initialCash -= cashWithdrawal;
    isaValueBeforeWithdrawal -= isaWithdrawal;
    giaValueBeforeWithdrawal -= giaWithdrawal;

    const totalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const finalTaxableDCDrawdown = finalDcDrawdown * (1 - dcUfplsTaxFreePortion);
    const finalTaxableSippDrawdown = finalSippDrawdown * (1 - sippUfplsTaxFreePortion);

    const finalTotalGrossTaxableIncome = fixedTaxableIncome + finalTaxableDCDrawdown + finalTaxableSippDrawdown;
    const finalTotalGrossIncome = fixedTaxableIncome + finalDcDrawdown + finalSippDrawdown + totalSavingsWithdrawn;
    
    row['Income Subject to Tax'] = Math.max(0, finalTotalGrossTaxableIncome - currentPersonalAllowance);
    row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;
    row['TOTAL INCOME'] = finalTotalGrossIncome;
    row['Net Income Per Year'] = finalTotalGrossIncome - row['Income Tax Paid'];
    row['Net Income Per Month'] = row['Net Income Per Year'] / 12;

    const finalCashBalance = initialCash;
    const finalIsaBalance = isaValueBeforeWithdrawal;
    const finalGiaBalance = giaValueBeforeWithdrawal;
    row['DC Pension Balance'] = Math.max(0, dcPotForDrawdown);
    row['SIPP Balance'] = Math.max(0, sippPotForDrawdown);
    
    // Assign all values to the row object
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
