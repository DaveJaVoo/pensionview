
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION as GENERAL_UFPLS_TAX_FREE_PORTION } from './types';

/**
 * A helper function to determine the required gross pension drawdown to meet a specific net income shortfall.
 * This is necessary because pension drawdowns are taxable, so drawing £X gross results in less than £X net.
 * This function iteratively finds the correct gross amount.
 * @returns The required gross drawdown from DC and SIPP pots.
 */
function solveForPensionDrawdown(
  remainingShortfall: number,
  fixedGrossTaxableIncome: number,
  currentDCPot: number,
  dcUfplsTaxFreePortion: number,
  currentSippPot: number,
  sippUfplsTaxFreePortion: number,
  personalAllowance: number
): { dcDrawdown: number; sippDrawdown: number } {
  if (remainingShortfall <= 0) {
    return { dcDrawdown: 0, sippDrawdown: 0 };
  }

  let lowTotalPensionDrawdown = 0;
  let highTotalPensionDrawdown = currentDCPot + currentSippPot;
  const maxIterations = 50;
  const precision = 1.0;

  let bestGuess = { dcDrawdown: 0, sippDrawdown: 0 };

  for (let iter = 0; iter < maxIterations; iter++) {
    const guessTotalPensionDrawdown = (lowTotalPensionDrawdown + highTotalPensionDrawdown) / 2;
    if (guessTotalPensionDrawdown <= 0) break;

    const tempDcDrawdown = Math.min(guessTotalPensionDrawdown, currentDCPot);
    const tempSippDrawdown = Math.min(guessTotalPensionDrawdown - tempDcDrawdown, currentSippPot);

    const taxableDCDrawdown = tempDcDrawdown * (1 - dcUfplsTaxFreePortion);
    const taxableSippDrawdown = tempSippDrawdown * (1 - sippUfplsTaxFreePortion);
    const totalTaxableIncome = fixedGrossTaxableIncome + taxableDCDrawdown + taxableSippDrawdown;
    
    const taxOnFixedIncome = Math.max(0, fixedGrossTaxableIncome - personalAllowance) * INCOME_TAX_RATE;
    const totalTaxPaid = Math.max(0, totalTaxableIncome - personalAllowance) * INCOME_TAX_RATE;
    const taxOnDrawdown = totalTaxPaid - taxOnFixedIncome;
    
    const netFromDrawdown = (tempDcDrawdown + tempSippDrawdown) - taxOnDrawdown;
    
    bestGuess = { dcDrawdown: tempDcDrawdown, sippDrawdown: tempSippDrawdown };

    if (Math.abs(netFromDrawdown - remainingShortfall) < precision) {
      break;
    }

    if (netFromDrawdown < remainingShortfall) {
      lowTotalPensionDrawdown = guessTotalPensionDrawdown;
    } else {
      highTotalPensionDrawdown = guessTotalPensionDrawdown;
    }
  }
  
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

  const headers = ['Age', 'Year'];
  if (params.initialDcPensionValue > 0 || params.annualDcPensionContribution > 0) {
      headers.push('Initial DC Pension', 'DC Pension Contribution', 'DC Pension Growth', 'DC Pension + Growth', 'DC AMC Charge', 'DC Minus AMC', 'DC Pension Drawdown', 'DC Pension Balance');
  }
  if (params.initialSippValue > 0 || params.annualSippContribution > 0) {
      headers.push('Initial SIPP', 'SIPP Contribution', 'SIPP Growth', 'SIPP + Growth', 'SIPP AMC Charge', 'SIPP Minus AMC', 'SIPP Drawdown', 'SIPP Balance');
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

  const usePensionsFirst = !takeTaxFreeLumpSum && !takeSippTaxFreeLumpSum;

  for (let age = currentAge; age <= 90; age++) {
    const yearOffset = age - currentAge;
    const currentYearStr = (projectionStartYear + yearOffset).toString();
    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);
    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);

    const row: PensionDataRow = { Age: age, Year: currentYearStr, 'TOTAL INCOME': 0, 'Income Subject to Tax': 0, 'Income Tax Paid': 0, 'Net Income Per Year': 0, 'Net Income Per Month': 0 };

    const initialDCPension = previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection;
    const dcContributionThisYear = (age >= dcContributionStartAge && age < dcContributionEndAge && annualDcPensionContribution > 0) ? annualDcPensionContribution : 0;
    const dcPotBeforeGrowth = initialDCPension + dcContributionThisYear;
    const dcGrowth = dcPotBeforeGrowth * invGrowthDecimal;
    const dcPotAfterGrowth = dcPotBeforeGrowth + dcGrowth;
    const dcAmcCharge = dcPotAfterGrowth * amcDecimal;
    let dcPotForDrawdown = dcPotAfterGrowth - dcAmcCharge;

    const initialSipp = previousRow ? (previousRow['SIPP Balance'] || 0) : actualInitialSippForProjection;
    const sippContributionThisYear = (age >= sippContributionStartAge && age < sippContributionEndAge && annualSippContribution > 0) ? annualSippContribution : 0;
    const sippPotBeforeGrowth = initialSipp + sippContributionThisYear;
    const sippGrowth = sippPotBeforeGrowth * sippInvGrowthDecimal;
    const sippPotAfterGrowth = sippPotBeforeGrowth + sippGrowth;
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
    
    // --- WITHDRAWAL STRATEGY ---
    
    let dcDrawdown = 0;
    let sippDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    const fixedGrossTaxableIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear;
    const taxOnFixedIncome = Math.max(0, fixedGrossTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
    const netFromFixedIncome = fixedGrossTaxableIncome - taxOnFixedIncome;

    let shortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);

    if (usePensionsFirst) {
        // --- Strategy 1: UFPLS First (No upfront PCLS) ---
        const solvedDrawdowns = solveForPensionDrawdown(shortfall, fixedGrossTaxableIncome, dcPotForDrawdown, dcUfplsTaxFreePortion, sippPotForDrawdown, sippUfplsTaxFreePortion, currentPersonalAllowance);
        dcDrawdown = solvedDrawdowns.dcDrawdown;
        sippDrawdown = solvedDrawdowns.sippDrawdown;

        const taxableDCDrawdown = dcDrawdown * (1 - dcUfplsTaxFreePortion);
        const taxableSippDrawdown = sippDrawdown * (1 - sippUfplsTaxFreePortion);
        const taxOnDrawdown = Math.max(0, (fixedGrossTaxableIncome + taxableDCDrawdown + taxableSippDrawdown) - currentPersonalAllowance) * INCOME_TAX_RATE - taxOnFixedIncome;
        const netFromDrawdown = (dcDrawdown + sippDrawdown) - taxOnDrawdown;
        shortfall -= netFromDrawdown;

        // Use savings only if pensions are fully depleted and there's still a shortfall
        if (shortfall > 0) {
            cashWithdrawal = Math.min(shortfall, initialCash);
            shortfall -= cashWithdrawal;
            isaWithdrawal = Math.min(shortfall, isaValueBeforeWithdrawal);
            shortfall -= isaWithdrawal;
            giaWithdrawal = Math.min(shortfall, giaValueBeforeWithdrawal);
            shortfall -= giaWithdrawal;
        }

    } else {
        // --- Strategy 2: Savings First (Upfront PCLS was taken) ---
        // Step 2a: Still smart to use pension to fill up personal allowance tax-free
        let dcDrawdownForAllowance = 0;
        let sippDrawdownForAllowance = 0;
        const unusedPersonalAllowance = Math.max(0, currentPersonalAllowance - fixedGrossTaxableIncome);

        if (unusedPersonalAllowance > 0) {
            let taxableAmountToDraw = unusedPersonalAllowance;
            const dcTaxablePortionRate = 1 - dcUfplsTaxFreePortion; // Will be 1.0 if PCLS taken
            if (dcTaxablePortionRate > 0) {
                const grossDcNeeded = taxableAmountToDraw / dcTaxablePortionRate;
                dcDrawdownForAllowance = Math.min(grossDcNeeded, dcPotForDrawdown);
                taxableAmountToDraw -= dcDrawdownForAllowance * dcTaxablePortionRate;
            }
            if (taxableAmountToDraw > 0) {
                const sippTaxablePortionRate = 1 - sippUfplsTaxFreePortion; // Will be 1.0 if PCLS taken
                if (sippTaxablePortionRate > 0) {
                    const grossSippNeeded = taxableAmountToDraw / sippTaxablePortionRate;
                    sippDrawdownForAllowance = Math.min(grossSippNeeded, sippPotForDrawdown);
                }
            }
        }
        const netFromAllowanceDrawdown = dcDrawdownForAllowance + sippDrawdownForAllowance; // No tax as it's within PA
        shortfall -= netFromAllowanceDrawdown;
        dcPotForDrawdown -= dcDrawdownForAllowance;
        sippPotForDrawdown -= sippDrawdownForAllowance;

        // Step 2b: Use savings
        cashWithdrawal = Math.min(shortfall, initialCash);
        shortfall -= cashWithdrawal;
        isaWithdrawal = Math.min(shortfall, isaValueBeforeWithdrawal);
        shortfall -= isaWithdrawal;
        giaWithdrawal = Math.min(shortfall, giaValueBeforeWithdrawal);
        shortfall -= giaWithdrawal;

        // Step 2c: Use pensions again if savings run out
        let dcDrawdownForShortfall = 0;
        let sippDrawdownForShortfall = 0;
        if (shortfall > 0) {
            const fixedTaxableForSolver = fixedGrossTaxableIncome + (dcDrawdownForAllowance * (1 - dcUfplsTaxFreePortion)) + (sippDrawdownForAllowance * (1 - sippUfplsTaxFreePortion));
            const solvedDrawdowns = solveForPensionDrawdown(shortfall, fixedTaxableForSolver, dcPotForDrawdown, dcUfplsTaxFreePortion, sippPotForDrawdown, sippUfplsTaxFreePortion, currentPersonalAllowance);
            dcDrawdownForShortfall = solvedDrawdowns.dcDrawdown;
            sippDrawdownForShortfall = solvedDrawdowns.sippDrawdown;
        }

        dcDrawdown = dcDrawdownForAllowance + dcDrawdownForShortfall;
        sippDrawdown = sippDrawdownForAllowance + sippDrawdownForShortfall;
    }

    // --- Standard Percentage Withdrawal Override (post-SPA) ---
    if (age >= statePensionAge) {
      const fullDcPotForRate = (previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection) + dcContributionThisYear;
      const dcDrawdownByRate = (fullDcPotForRate + fullDcPotForRate * invGrowthDecimal - (fullDcPotForRate + fullDcPotForRate*invGrowthDecimal)*amcDecimal) * dcWithdrawDecimal;
      if (dcDrawdownByRate > dcDrawdown) {
          dcDrawdown = dcDrawdownByRate;
      }
      
      const fullSippPotForRate = (previousRow ? (previousRow['SIPP Balance'] || 0) : actualInitialSippForProjection) + sippContributionThisYear;
      const sippDrawdownByRate = (fullSippPotForRate + fullSippPotForRate * sippInvGrowthDecimal - (fullSippPotForRate + fullSippPotForRate*sippInvGrowthDecimal)*sippAmcDecimal) * sippWithdrawDecimal;
      if (sippDrawdownByRate > sippDrawdown) {
          sippDrawdown = sippDrawdownByRate;
      }
    }
    
    const finalDcDrawdown = Math.min(dcDrawdown, dcPotForDrawdown);
    const finalSippDrawdown = Math.min(sippDrawdown, sippPotForDrawdown);

    // --- Final Row Calculations ---
    const totalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const taxableDCDrawdownFinal = finalDcDrawdown * (1 - dcUfplsTaxFreePortion);
    const taxableSippDrawdownFinal = finalSippDrawdown * (1 - sippUfplsTaxFreePortion);
    const totalTaxableIncome = fixedGrossTaxableIncome + taxableDCDrawdownFinal + taxableSippDrawdownFinal;
    
    row['Income Subject to Tax'] = Math.max(0, totalTaxableIncome - currentPersonalAllowance);
    row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;
    row['TOTAL INCOME'] = fixedGrossTaxableIncome + totalSavingsWithdrawn + finalDcDrawdown + finalSippDrawdown;
    row['Net Income Per Year'] = row['TOTAL INCOME'] - row['Income Tax Paid'];
    row['Net Income Per Month'] = row['Net Income Per Year'] / 12;

    const finalCashBalance = initialCash - cashWithdrawal;
    const finalIsaBalance = isaValueBeforeWithdrawal - isaWithdrawal;
    const finalGiaBalance = giaValueBeforeWithdrawal - giaWithdrawal;
    row['DC Pension Balance'] = Math.max(0, dcPotForDrawdown - finalDcDrawdown);
    row['SIPP Balance'] = Math.max(0, sippPotForDrawdown - finalSippDrawdown);

    // --- Assign all calculated values to the row object for the table ---
    if (headers.includes('Initial DC Pension')) {
      Object.assign(row, {
        'Initial DC Pension': initialDCPension, 'DC Pension Contribution': dcContributionThisYear,
        'DC Pension Growth': dcGrowth, 'DC Pension + Growth': dcPotAfterGrowth,
        'DC AMC Charge': dcAmcCharge, 'DC Minus AMC': dcPotForDrawdown + finalDcDrawdown,
        'DC Pension Drawdown': finalDcDrawdown
      });
    }
    if (headers.includes('Initial SIPP')) {
        Object.assign(row, {
            'Initial SIPP': initialSipp, 'SIPP Contribution': sippContributionThisYear,
            'SIPP Growth': sippGrowth, 'SIPP + Growth': sippPotAfterGrowth,
            'SIPP AMC Charge': sippAmcCharge, 'SIPP Minus AMC': sippPotForDrawdown + finalSippDrawdown,
            'SIPP Drawdown': finalSippDrawdown
        });
    }
    if (headers.includes('DB Pension')) row['DB Pension'] = dbPensionThisYear;
    if (headers.includes('State Pension')) row['State Pension'] = statePensionThisYear;
    if (headers.includes('Other Income')) row['Other Income'] = otherIncomeThisYear;
    if (showCash) Object.assign(row, { 'Cash Savings Initial': initialCash, 'Withdraw from Cash': cashWithdrawal, 'Cash Savings Balance': finalCashBalance });
    if (showIsa) Object.assign(row, { 'ISA Initial': initialIsa, 'ISA Growth': isaGrowth, 'ISA Value Before Withdrawal': isaValueBeforeWithdrawal, 'Withdraw from ISA': isaWithdrawal, 'ISA Balance': finalIsaBalance });
    if (showGia) Object.assign(row, { 'GIA Initial': initialGia, 'GIA Growth': giaGrowth, 'GIA Value Before Withdrawal': giaValueBeforeWithdrawal, 'Withdraw from GIA': giaWithdrawal, 'GIA Balance': finalGiaBalance });
    if(showCash || showIsa || showGia) {
      Object.assign(row, { 'Total Savings Withdrawn': totalSavingsWithdrawn, 'Total Savings Balance': finalCashBalance + finalIsaBalance + finalGiaBalance});
    }

    headers.forEach(header => {
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
