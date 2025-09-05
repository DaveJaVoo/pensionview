
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';

export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, projectionStartYear, projectionEndAge, targetAnnualNetIncome, calculationTriggerYear,
    initialDbPensionAmount, dbPensionStartAge,
    statePensionAge, initialStatePensionAmount,
    initialOtherIncome, initialFasAmount, fasStartAge,
    
    initialDcPensionValue,
    annualDcPensionContribution, dcContributionStartAge, dcContributionEndAge,
    investmentPercentageGrowth, dcWithdrawalRate, annualChargeAMC, takeTaxFreeLumpSum,
    applyDcWithdrawalRateInSurplus,

    initialSippValue,
    annualSippContribution, sippContributionStartAge, sippContributionEndAge,
    sippInvestmentPercentageGrowth, sippAnnualChargeAMC, takeSippTaxFreeLumpSum,
    applySippWithdrawalRateInSurplus,
    
    inflationRate,
    initialCashSavings, initialIsaAmount, isaGrowthRate, initialGiaAmount, giaGrowthRate
  } = params;

  const ageAtProjectionStart = currentAge + (projectionStartYear - calculationTriggerYear);
  
  // This check is now removed as per user request to allow projections before pension age.
  // if (ageAtProjectionStart < minPensionAccessAge) { ... }
  
  const headers: string[] = ['Age', 'Year'];
  const showDcPension = initialDcPensionValue > 0 || annualDcPensionContribution > 0;
  const showSipp = initialSippValue > 0 || annualSippContribution > 0;

  if (showDcPension) {
      headers.push('Initial DC Pension', 'DC Pension Drawdown');
      if (annualDcPensionContribution > 0) {
        headers.push('DC Pension Contribution');
      }
      headers.push('DC AMC Charge', 'DC Pension Growth', 'DC Pension + Growth', 'DC Pension Balance');
  }
  if (showSipp) {
      headers.push('Initial SIPP', 'SIPP Drawdown');
      if (annualSippContribution > 0) {
          headers.push('SIPP Contribution');
      }
      headers.push('SIPP AMC Charge', 'SIPP Growth', 'SIPP + Growth', 'SIPP Balance');
  }
  if (initialDbPensionAmount > 0) {
      headers.push('DB Pension');
  }
   if (initialStatePensionAmount > 0) {
      headers.push('State Pension');
  }
  if (initialOtherIncome > 0) {
      headers.push('Other Income');
  }
  if (initialFasAmount > 0) {
      headers.push('FAS');
  }
  const showCash = initialCashSavings > 0;
  const showIsa = initialIsaAmount > 0;
  const showGia = initialGiaAmount > 0;
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

  let actualInitialDcPensionForProjection = initialDcPensionValue;
  let taxFreeLumpSumTakenAmount = 0;
  const dcUfplsTaxFreePortion = takeTaxFreeLumpSum ? 0 : UFPLS_TAX_FREE_PORTION;

  if (takeTaxFreeLumpSum) {
    taxFreeLumpSumTakenAmount = initialDcPensionValue * 0.25;
    actualInitialDcPensionForProjection = initialDcPensionValue * 0.75;
  }

  let actualInitialSippForProjection = initialSippValue;
  let sippTaxFreeLumpSumTakenAmount = 0;
  const sippUfplsTaxFreePortion = takeSippTaxFreeLumpSum ? 0 : UFPLS_TAX_FREE_PORTION;

  if (takeSippTaxFreeLumpSum) {
    sippTaxFreeLumpSumTakenAmount = initialSippValue * 0.25;
    actualInitialSippForProjection = initialSippValue * 0.75;
  }

  const outputParameters = { 
    ...params, 
    taxFreeLumpSumTaken: taxFreeLumpSumTakenAmount,
    sippTaxFreeLumpSumTaken: sippTaxFreeLumpSumTakenAmount,
  };

  for (let age = ageAtProjectionStart; age <= projectionEndAge; age++) {
    const yearOffset = age - ageAtProjectionStart;
    const currentYear = projectionStartYear + yearOffset;
    const currentYearStr = currentYear.toString();
    const minPensionAccessAge = currentYear >= 2028 ? 57 : 55;
    const isFirstYear = yearOffset === 0;

    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);
    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);

    const row: PensionDataRow = { Age: age, Year: currentYearStr };

    // --- POT VALUES AT START OF YEAR ---
    const initialDcPension = previousRow ? (previousRow['DC Pension Balance'] || 0) : actualInitialDcPensionForProjection;
    const initialSipp = previousRow ? (previousRow['SIPP Balance'] || 0) : actualInitialSippForProjection;

    // --- SAVINGS VALUES AT START OF YEAR ---
    const initialCash = showCash ? (previousRow ? (previousRow['Cash Savings Balance'] || 0) : initialCashSavings) : 0;
    const isaStartOfYear = (previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount);
    const isaGrowth = isaStartOfYear * isaGrowthDecimal;
    const isaValueBeforeWithdrawal = isaStartOfYear + isaGrowth;
    const giaStartOfYear = (previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount);
    const giaGrowth = giaStartOfYear * giaGrowthDecimal;
    const giaValueBeforeWithdrawal = giaStartOfYear + giaGrowth;

    // --- WITHDRAWAL WATERFALL ---
    let dcDrawdown = 0;
    let sippDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = initialOtherIncome > 0 ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    const fasThisYear = (initialFasAmount > 0 && age >= fasStartAge) ? initialFasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;
    
    const fixedTaxableIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + fasThisYear;
    const taxOnFixedIncome = Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
    const netFromFixedIncome = fixedTaxableIncome - taxOnFixedIncome;

    let netShortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);

    const savingsFirstStrategy = takeTaxFreeLumpSum || takeSippTaxFreeLumpSum;

    if (netShortfall > 0) { // Only enter withdrawal logic if there is a shortfall
        const pensionDrawdownOrder = () => {
          if (!showDcPension) return ['sipp'];
          if (!showSipp) return ['dc'];

          if (amcDecimal > sippAmcDecimal) return ['dc', 'sipp'];
          if (sippAmcDecimal > amcDecimal) return ['sipp', 'dc'];
          
          if (invGrowthDecimal < sippInvGrowthDecimal) return ['dc', 'sipp'];
          if (sippInvGrowthDecimal < invGrowthDecimal) return ['sipp', 'dc'];

          if (initialDcPension <= initialSipp) return ['dc', 'sipp'];
          return ['sipp', 'dc'];
        };
        const orderedPots = pensionDrawdownOrder();

        const executePensionDrawdown = (drawdownFunction: (potType: 'dc' | 'sipp') => number) => {
          for (const pot of orderedPots) {
            if (netShortfall > 0) {
              if (pot === 'dc') {
                dcDrawdown += drawdownFunction('dc');
              } else {
                sippDrawdown += drawdownFunction('sipp');
              }
            }
          }
        };

        if (savingsFirstStrategy) {
            // --- SAVINGS-FIRST WATERFALL (Tax-efficient when pensions are fully taxable) ---
            if (netShortfall > 0 && showCash) { const draw = Math.min(initialCash, netShortfall); cashWithdrawal += draw; netShortfall -= draw; }
            if (netShortfall > 0 && showIsa) { const draw = Math.min(isaValueBeforeWithdrawal, netShortfall); isaWithdrawal += draw; netShortfall -= draw; }
            if (netShortfall > 0 && showGia) { const draw = Math.min(giaValueBeforeWithdrawal, netShortfall); giaWithdrawal += draw; netShortfall -= draw; }

            if (netShortfall > 0 && age >= minPensionAccessAge) {
                let taxableIncomeSoFar = fixedTaxableIncome;
                const netPerGross = 1 - INCOME_TAX_RATE;

                const drawFromPension = (potType: 'dc' | 'sipp') => {
                    const pot = potType === 'dc' ? initialDcPension : initialSipp;
                    const currentDrawdown = potType === 'dc' ? dcDrawdown : sippDrawdown;

                    if (netShortfall <= 0 || pot <= currentDrawdown) return 0;
                    
                    let totalDraw = 0;
                    const paRoom = Math.max(0, currentPersonalAllowance - taxableIncomeSoFar);
                    if (paRoom > 0) {
                        const draw = Math.min(pot - currentDrawdown, paRoom, netShortfall);
                        totalDraw += draw;
                        netShortfall -= draw;
                        taxableIncomeSoFar += draw;
                    }
                    if (netShortfall > 0 && netPerGross > 0) {
                        const grossNeeded = netShortfall / netPerGross;
                        const draw = Math.min(pot - currentDrawdown - totalDraw, grossNeeded);
                        totalDraw += draw;
                        netShortfall -= draw * netPerGross;
                    }
                    return totalDraw;
                };
                executePensionDrawdown(drawFromPension);
            }
        } else {
            // --- PENSION-FIRST WATERFALL (Tax-efficient with UFPLS) ---
            if (netShortfall > 0 && age >= minPensionAccessAge) {
                let taxableIncomeSoFar = fixedTaxableIncome;
                const drawToFillPA = (potType: 'dc' | 'sipp') => {
                     const pot = potType === 'dc' ? initialDcPension : initialSipp;
                     const taxFreePortion = potType === 'dc' ? dcUfplsTaxFreePortion : sippUfplsTaxFreePortion;
                     if (netShortfall <= 0) return 0;
                     const taxablePortion = 1 - taxFreePortion;
                     if (taxablePortion <= 0) return 0;

                     const paRoom = Math.max(0, currentPersonalAllowance - taxableIncomeSoFar);
                     if (paRoom <= 0) return 0;
                     
                     const maxGrossDraw = paRoom / taxablePortion;
                     const netFromDraw = (maxGrossDraw * taxFreePortion) + (maxGrossDraw * taxablePortion); 
                     const draw = Math.min(pot, maxGrossDraw, netFromDraw > netShortfall ? netShortfall : pot);
                     
                     const netFromThisDraw = (draw * taxFreePortion) + (draw * taxablePortion);
                     netShortfall -= netFromThisDraw;
                     taxableIncomeSoFar += draw * taxablePortion;
                     return draw;
                };
                executePensionDrawdown(drawToFillPA);
            }

            if (netShortfall > 0 && showCash) { const draw = Math.min(initialCash - cashWithdrawal, netShortfall); cashWithdrawal += draw; netShortfall -= draw; }
            if (netShortfall > 0 && showIsa) { const draw = Math.min(isaValueBeforeWithdrawal - isaWithdrawal, netShortfall); isaWithdrawal += draw; netShortfall -= draw; }
            if (netShortfall > 0 && showGia) { const draw = Math.min(giaValueBeforeWithdrawal - giaWithdrawal, netShortfall); giaWithdrawal += draw; netShortfall -= draw; }

            if (netShortfall > 0 && age >= minPensionAccessAge) {
                 const drawTaxably = (potType: 'dc' | 'sipp') => {
                    const pot = potType === 'dc' ? initialDcPension : initialSipp;
                    const currentDrawdown = potType === 'dc' ? dcDrawdown : sippDrawdown;
                    const taxFreePortion = potType === 'dc' ? dcUfplsTaxFreePortion : sippUfplsTaxFreePortion;

                    if (netShortfall <= 0) return 0;
                    const taxablePortion = 1 - taxFreePortion;
                    const netPerGross = 1 - (INCOME_TAX_RATE * taxablePortion);
                    if (netPerGross <= 0) return 0;

                    const grossNeeded = netShortfall / netPerGross;
                    const draw = Math.min(pot - currentDrawdown, grossNeeded);
                    netShortfall -= draw * netPerGross;
                    return draw;
                };
                executePensionDrawdown(drawTaxably);
            }
        }
    }

    // --- APPLY STANDARD WITHDRAWAL RATE in surplus years if enabled ---
    const isSurplusYear = netShortfall <= 0;
    if (age >= minPensionAccessAge && isSurplusYear) {
      if (applyDcWithdrawalRateInSurplus && showDcPension) {
          const dcStandardWithdrawal = initialDcPension * dcWithdrawDecimal;
          if (dcStandardWithdrawal > dcDrawdown) {
              dcDrawdown = Math.min(initialDcPension, dcStandardWithdrawal);
          }
      }
      if (applySippWithdrawalRateInSurplus && showSipp) {
          const sippStandardWithdrawal = initialSipp * sippWithdrawDecimal;
          if (sippStandardWithdrawal > sippDrawdown) {
              sippDrawdown = Math.min(initialSipp, sippStandardWithdrawal);
          }
      }
    }
    
    // --- POT CALCULATIONS (after withdrawals) ---
    const dcPotAfterDrawdown = Math.max(0, initialDcPension - dcDrawdown);
    const sippPotAfterDrawdown = Math.max(0, initialSipp - sippDrawdown);

    const dcAmcCharge = dcPotAfterDrawdown * amcDecimal;
    const sippAmcCharge = sippPotAfterDrawdown * sippAmcDecimal;

    const dcPotBeforeGrowth = dcPotAfterDrawdown - dcAmcCharge;
    const sippPotBeforeGrowth = sippPotAfterDrawdown - sippAmcCharge;

    const dcContributionThisYear = (age >= dcContributionStartAge && age < dcContributionEndAge && annualDcPensionContribution > 0) ? annualDcPensionContribution : 0;
    const sippContributionThisYear = (age >= sippContributionStartAge && age < sippContributionEndAge && annualSippContribution > 0) ? annualSippContribution : 0;
    
    const dcPotForGrowth = dcPotBeforeGrowth + dcContributionThisYear;
    const sippPotForGrowth = sippPotBeforeGrowth + sippContributionThisYear;
    
    // No growth in the first year
    const dcGrowth = isFirstYear ? 0 : dcPotForGrowth * invGrowthDecimal;
    const sippGrowth = isFirstYear ? 0 : sippPotForGrowth * sippInvGrowthDecimal;

    const finalDcBalance = Math.max(0, dcPotForGrowth + dcGrowth);
    const finalSippBalance = Math.max(0, sippPotForGrowth + sippGrowth);


    // --- FINAL TALLY ---
    const finalTotalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const finalGrossPensionDrawdown = dcDrawdown + sippDrawdown;

    const nonTaxablePensionIncome = (dcDrawdown * dcUfplsTaxFreePortion) + (sippDrawdown * sippUfplsTaxFreePortion);
    const taxablePensionIncome = finalGrossPensionDrawdown - nonTaxablePensionIncome;

    const finalTotalTaxableIncome = fixedTaxableIncome + taxablePensionIncome;
    const incomeSubjectToTaxForTable = Math.max(0, finalTotalTaxableIncome - currentPersonalAllowance);
    const finalTaxPaid = incomeSubjectToTaxForTable * INCOME_TAX_RATE;
    
    const finalTotalGrossIncome = fixedTaxableIncome + finalGrossPensionDrawdown + finalTotalSavingsWithdrawn;
    const finalNetIncome = finalTotalGrossIncome - finalTaxPaid;
    
    row['TOTAL INCOME'] = finalTotalGrossIncome;
    row['Income Subject to Tax'] = incomeSubjectToTaxForTable;
    row['Income Tax Paid'] = finalTaxPaid;
    row['Net Income Per Year'] = finalNetIncome;
    row['Net Income Per Month'] = finalNetIncome / 12;

    const finalCashBalance = initialCash - cashWithdrawal;
    const finalIsaBalance = isaValueBeforeWithdrawal - isaWithdrawal;
    const finalGiaBalance = giaValueBeforeWithdrawal - giaWithdrawal;
    
    if (showDcPension) {
      Object.assign(row, { 'Initial DC Pension': initialDcPension });
      row['DC Pension Drawdown'] = dcDrawdown;
      if (annualDcPensionContribution > 0) {
        row['DC Pension Contribution'] = dcContributionThisYear;
      }
      Object.assign(row, {
        'DC AMC Charge': dcAmcCharge, 
        'DC Pension Growth': dcGrowth, 
        'DC Pension + Growth': dcPotForGrowth + dcGrowth,
        'DC Pension Balance': finalDcBalance
      });
    }

    if (showSipp) {
        Object.assign(row, { 'Initial SIPP': initialSipp });
        row['SIPP Drawdown'] = sippDrawdown;
        if(annualSippContribution > 0) {
            row['SIPP Contribution'] = sippContributionThisYear;
        }
        Object.assign(row, {
            'SIPP AMC Charge': sippAmcCharge, 
            'SIPP Growth': sippGrowth, 
            'SIPP + Growth': sippPotForGrowth + sippGrowth,
            'SIPP Balance': finalSippBalance
        });
    }

    if (initialDbPensionAmount > 0) row['DB Pension'] = dbPensionThisYear;
    if (initialStatePensionAmount > 0) row['State Pension'] = statePensionThisYear;
    if (initialOtherIncome > 0) row['Other Income'] = otherIncomeThisYear;
    if (initialFasAmount > 0) row['FAS'] = fasThisYear;
    
    if (showCash) Object.assign(row, { 'Cash Savings Initial': initialCash, 'Withdraw from Cash': cashWithdrawal, 'Cash Savings Balance': finalCashBalance });
    if (showIsa) Object.assign(row, { 'ISA Initial': isaStartOfYear, 'ISA Growth': isaGrowth, 'ISA Value Before Withdrawal': isaValueBeforeWithdrawal, 'Withdraw from ISA': isaWithdrawal, 'ISA Balance': finalIsaBalance });
    if (showGia) Object.assign(row, { 'GIA Initial': giaStartOfYear, 'GIA Growth': giaGrowth, 'GIA Value Before Withdrawal': giaValueBeforeWithdrawal, 'Withdraw from GIA': giaWithdrawal, 'GIA Balance': finalGiaBalance });
    
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
