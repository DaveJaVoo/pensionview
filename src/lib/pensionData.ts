
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';

export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, retirementAge, projectionEndAge, targetAnnualNetIncome, calculationTriggerYear,
    initialDbPensionAmount, dbPensionStartAge,
    statePensionAge, initialStatePensionAmount,
    initialOtherIncome, initialFasAmount, fasStartAge,
    
    initialDcPensionValue,
    annualDcPensionContribution, dcContributionEndAge,
    investmentPercentageGrowth, dcWithdrawalRate, annualChargeAMC, takeTaxFreeLumpSum,
    applyDcWithdrawalRateInSurplus,

    initialSippValue,
    annualSippContribution, sippContributionEndAge,
    sippInvestmentPercentageGrowth, sippAnnualChargeAMC, takeSippTaxFreeLumpSum,
    applySippWithdrawalRateInSurplus, sippWithdrawalRate,
    
    inflationRate,
    initialCashSavings, initialIsaAmount, isaGrowthRate, initialGiaAmount, giaGrowthRate
  } = params;
  
  const headers: string[] = ['Age', 'Year'];
  const showDcPension = initialDcPensionValue > 0 || annualDcPensionContribution > 0;
  const showSipp = initialSippValue > 0 || annualSippContribution > 0;

  if (showDcPension) {
    const dcHeaders = ['Initial DC Pension'];
    if (annualDcPensionContribution > 0) dcHeaders.push('DC Pension Contribution');
    dcHeaders.push('DC Pension Drawdown', 'DC AMC Charge', 'DC Pension After Deductions', 'DC Pension Growth', 'DC Pension Balance');
    headers.splice(2, 0, ...dcHeaders);
  }
  if (showSipp) {
    const sippHeaders = ['Initial SIPP'];
    if (annualSippContribution > 0) sippHeaders.push('SIPP Contribution');
    sippHeaders.push('SIPP Drawdown', 'SIPP AMC Charge', 'SIPP After Deductions', 'SIPP Growth', 'SIPP Balance');
    const dcOffset = showDcPension ? 7 : 0;
    headers.splice(2 + dcOffset, 0, ...sippHeaders);
  }

  const otherIncomeSources = [
    { amount: initialDbPensionAmount, header: 'DB Pension' },
    { amount: initialStatePensionAmount, header: 'State Pension' },
    { amount: initialOtherIncome, header: 'Other Income' },
    { amount: initialFasAmount, header: 'FAS' }
  ];
  otherIncomeSources.forEach(source => {
    if (source.amount > 0) headers.push(source.header);
  });

  const showCash = initialCashSavings > 0;
  const showIsa = initialIsaAmount > 0;
  const showGia = initialGiaAmount > 0;

  if (showCash) headers.push('Cash Savings Initial', 'Withdraw from Cash', 'Cash Savings Balance');
  if (showIsa) headers.push('ISA Initial', 'ISA Growth', 'ISA Value Before Withdrawal', 'Withdraw from ISA', 'ISA Balance');
  if (showGia) headers.push('GIA Initial', 'GIA Growth', 'GIA Value Before Withdrawal', 'Withdraw from GIA', 'GIA Balance');
  if (showCash || showIsa || showGia) headers.push('Total Savings Withdrawn', 'Total Savings Balance');
  
  headers.push('TOTAL INCOME', 'Income Subject to Tax', 'Income Tax Paid', 'Net Income Per Year', 'Net Income Per Month');

  const rows: PensionDataRow[] = [];
  let previousRow: PensionDataRow | null = null;
  
  const inflationDecimal = (inflationRate || 0) / 100;
  const isaGrowthDecimal = (isaGrowthRate || 0) / 100;
  const giaGrowthDecimal = (giaGrowthRate || 0) / 100;

  let actualInitialDcPensionForProjection = initialDcPensionValue;
  let taxFreeLumpSumTakenAmount = 0;
  if (takeTaxFreeLumpSum && currentAge >= retirementAge) {
    taxFreeLumpSumTakenAmount = initialDcPensionValue * 0.25;
    actualInitialDcPensionForProjection = initialDcPensionValue * 0.75;
  }

  let actualInitialSippForProjection = initialSippValue;
  let sippTaxFreeLumpSumTakenAmount = 0;
  if (takeSippTaxFreeLumpSum && currentAge >= retirementAge) {
    sippTaxFreeLumpSumTakenAmount = initialSippValue * 0.25;
    actualInitialSippForProjection = initialSippValue * 0.75;
  }

  const outputParameters = { 
    ...params, 
    taxFreeLumpSumTaken: taxFreeLumpSumTakenAmount,
    sippTaxFreeLumpSumTaken: sippTaxFreeLumpSumTakenAmount,
  };

  const projectionStartYear = calculationTriggerYear;

  for (let age = currentAge; age <= projectionEndAge; age++) {
    const yearOffset = age - currentAge;
    const currentYear = projectionStartYear + yearOffset;

    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);
    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);

    const row: PensionDataRow = { Age: age, Year: String(currentYear) };

    // --- SAVINGS VALUES AT START OF YEAR ---
    const initialCash = showCash ? (previousRow ? (previousRow['Cash Savings Balance'] || 0) : initialCashSavings) : 0;
    const giaStartOfYear = (previousRow ? (previousRow['GIA Balance'] || 0) : initialGiaAmount);
    const giaGrowth = giaStartOfYear * giaGrowthDecimal;
    const giaValueBeforeWithdrawal = giaStartOfYear + giaGrowth;
    const isaStartOfYear = (previousRow ? (previousRow['ISA Balance'] || 0) : initialIsaAmount);
    const isaGrowth = isaStartOfYear * isaGrowthDecimal;
    const isaValueBeforeWithdrawal = isaStartOfYear + isaGrowth;

    // --- PENSION POTS ---
    const processPensionPot = (potType: 'DC' | 'SIPP') => {
      const initialValue = potType === 'DC' ? actualInitialDcPensionForProjection : actualInitialSippForProjection;
      const balance = previousRow ? (previousRow[`${potType} Pension Balance`] || 0) : initialValue;
      const contribution = (age >= currentAge && age < (potType === 'DC' ? dcContributionEndAge : sippContributionEndAge) && (potType === 'DC' ? annualDcPensionContribution : annualSippContribution) > 0) ? (potType === 'DC' ? annualDcPensionContribution : annualSippContribution) : 0;
      const growthRate = (potType === 'DC' ? investmentPercentageGrowth : sippInvestmentPercentageGrowth) / 100;
      const amc = (potType === 'DC' ? annualChargeAMC : sippAnnualChargeAMC) / 100;

      return { balance, contribution, growthRate, amc };
    };

    const dcPot = showDcPension ? processPensionPot('DC') : null;
    const sippPot = showSipp ? processPensionPot('SIPP') : null;
    
    row['Initial DC Pension'] = dcPot?.balance ?? 0;
    row['DC Pension Contribution'] = dcPot?.contribution ?? 0;
    row['Initial SIPP'] = sippPot?.balance ?? 0;
    row['SIPP Contribution'] = sippPot?.contribution ?? 0;

    // --- WITHDRAWAL WATERFALL ---
    let dcDrawdown = 0;
    let sippDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    const isInRetirement = age >= retirementAge;

    // --- Non-Discretionary Income First ---
    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = initialOtherIncome > 0 ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    const fasThisYear = (initialFasAmount > 0 && age >= fasStartAge) ? initialFasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;
    
    let netShortfall = 0;
    let fixedTaxableIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + fasThisYear;

    if (isInRetirement) {
        const taxOnFixedIncome = Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
        const netFromFixedIncome = fixedTaxableIncome - taxOnFixedIncome;
        netShortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);
    }
    
    if (isInRetirement && netShortfall > 0) {
        // --- Discretionary Withdrawals (Cash -> GIA -> ISA -> Pensions) ---
        // 1. Cash
        if (showCash) {
            const draw = Math.min(initialCash, netShortfall);
            cashWithdrawal += draw;
            netShortfall -= draw;
        }
        // 2. GIA
        if (showGia && netShortfall > 0) {
            const draw = Math.min(giaValueBeforeWithdrawal, netShortfall);
            giaWithdrawal += draw;
            netShortfall -= draw;
        }
        // 3. ISA
        if (showIsa && netShortfall > 0) {
            const draw = Math.min(isaValueBeforeWithdrawal, netShortfall);
            isaWithdrawal += draw;
            netShortfall -= draw;
        }

        // 4. Pensions (if still a shortfall)
        if (netShortfall > 0) {
          const pensionDrawdownOrder = () => {
            if (!dcPot) return ['sipp'];
            if (!sippPot) return ['dc'];
            
            if (dcPot.amc > sippPot.amc) return ['dc', 'sipp'];
            if (sippPot.amc > dcPot.amc) return ['sipp', 'dc'];
            
            if (dcPot.growthRate < sippPot.growthRate) return ['dc', 'sipp'];
            if (sippPot.growthRate < dcPot.growthRate) return ['sipp', 'dc'];

            if (dcPot.balance <= sippPot.balance) return ['dc', 'sipp'];
            return ['sipp', 'dc'];
          };
          const orderedPots = pensionDrawdownOrder();
          
          let totalTaxableIncomeSoFar = fixedTaxableIncome;

          for (const potType of orderedPots) {
              if (netShortfall <= 0.01) break;
              
              const currentPot = potType === 'dc' ? dcPot : sippPot;
              if (!currentPot || currentPot.balance <= 0) continue;

              const potBalance = currentPot.balance + currentPot.contribution;
              const takeLumpSum = potType === 'dc' ? takeTaxFreeLumpSum : takeSippTaxFreeLumpSum;
              const ufplsTaxFreePortion = takeLumpSum ? 0 : UFPLS_TAX_FREE_PORTION;
              const taxablePortionRate = 1 - ufplsTaxFreePortion;
              
              let grossWithdrawalNeeded = netShortfall;
              if (taxablePortionRate > 0) {
                  const taxableIncomeSoFarPlusDraw = totalTaxableIncomeSoFar + (grossWithdrawalNeeded * taxablePortionRate);
                  if (taxableIncomeSoFarPlusDraw > currentPersonalAllowance) {
                      grossWithdrawalNeeded = netShortfall / (1 - (INCOME_TAX_RATE * taxablePortionRate));
                  }
              }
              
              let draw = Math.min(potBalance, grossWithdrawalNeeded);
              draw = Math.max(0, draw);

              const taxablePartOfDraw = draw * taxablePortionRate;
              const taxOnThisDraw = Math.max(0, (totalTaxableIncomeSoFar + taxablePartOfDraw) - currentPersonalAllowance) * INCOME_TAX_RATE
                                    - Math.max(0, totalTaxableIncomeSoFar - currentPersonalAllowance) * INCOME_TAX_RATE;
              const netFromThisDraw = draw - taxOnThisDraw;

              if (potType === 'dc') dcDrawdown += draw;
              else sippDrawdown += draw;
              
              totalTaxableIncomeSoFar += taxablePartOfDraw;
              netShortfall -= netFromThisDraw;
          }
        }
    }

    const isSurplusYear = () => {
      if (!isInRetirement) return false;
      const netFromFixed = fixedTaxableIncome - Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
      return netFromFixed >= inflatedTargetNetIncome;
    };

    if (isInRetirement && isSurplusYear()) {
      if (applyDcWithdrawalRateInSurplus && dcPot) {
          const dcStandardWithdrawal = (dcPot.balance + dcPot.contribution - dcDrawdown) * dcWithdrawalRate / 100;
          dcDrawdown += Math.max(0, dcStandardWithdrawal);
      }
      if (applySippWithdrawalRateInSurplus && sippPot) {
          const sippStandardWithdrawal = (sippPot.balance + sippPot.contribution - sippDrawdown) * sippWithdrawalRate / 100;
          sippDrawdown += Math.max(0, sippStandardWithdrawal);
      }
    }
    
    if (dcPot) dcDrawdown = Math.min(dcPot.balance + dcPot.contribution, dcDrawdown);
    if (sippPot) sippDrawdown = Math.min(sippPot.balance + sippPot.contribution, sippDrawdown);

    // --- PENSION FINAL CALCULATIONS ---
    const calculateFinalBalance = (pot: { balance: number; contribution: number; growthRate: number; amc: number; } | null, drawdown: number) => {
      if (!pot) return { amcCharge: 0, afterDeductions: 0, growth: 0, finalBalance: 0 };
      const potAfterDrawdown = pot.balance + pot.contribution - drawdown;
      const amcCharge = potAfterDrawdown * pot.amc;
      const afterDeductions = potAfterDrawdown - amcCharge;
      const growth = afterDeductions * pot.growthRate;
      const finalBalance = Math.max(0, afterDeductions + growth);
      return { amcCharge, afterDeductions, growth, finalBalance };
    };

    const dcFinals = calculateFinalBalance(dcPot, dcDrawdown);
    const sippFinals = calculateFinalBalance(sippPot, sippDrawdown);

    // --- FINAL TALLY ---
    const finalTotalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const finalGrossPensionDrawdown = dcDrawdown + sippDrawdown;

    const taxableDcPensionIncome = dcDrawdown * (takeTaxFreeLumpSum ? 1 : (1 - UFPLS_TAX_FREE_PORTION));
    const taxableSippPensionIncome = sippDrawdown * (takeSippTaxFreeLumpSum ? 1 : (1 - UFPLS_TAX_FREE_PORTION));
    const taxablePensionIncome = taxableDcPensionIncome + taxableSippPensionIncome;

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
    
    if (showDcPension) Object.assign(row, { 'DC Pension Drawdown': dcDrawdown, 'DC AMC Charge': dcFinals.amcCharge, 'DC Pension After Deductions': dcFinals.afterDeductions, 'DC Pension Growth': dcFinals.growth, 'DC Pension Balance': dcFinals.finalBalance });
    if (showSipp) Object.assign(row, { 'SIPP Drawdown': sippDrawdown, 'SIPP AMC Charge': sippFinals.amcCharge, 'SIPP After Deductions': sippFinals.afterDeductions, 'SIPP Growth': sippFinals.growth, 'SIPP Balance': sippFinals.finalBalance });
    
    if (initialDbPensionAmount > 0) row['DB Pension'] = dbPensionThisYear;
    if (initialStatePensionAmount > 0) row['State Pension'] = statePensionThisYear;
    if (initialOtherIncome > 0) row['Other Income'] = otherIncomeThisYear;
    if (initialFasAmount > 0) row['FAS'] = fasThisYear;
    
    if (showCash) Object.assign(row, { 'Cash Savings Initial': initialCash, 'Withdraw from Cash': cashWithdrawal, 'Cash Savings Balance': finalCashBalance });
    if (showIsa) Object.assign(row, { 'ISA Initial': isaStartOfYear, 'ISA Growth': isaGrowth, 'ISA Value Before Withdrawal': isaValueBeforeWithdrawal, 'Withdraw from ISA': isaWithdrawal, 'ISA Balance': finalIsaBalance });
    if (showGia) Object.assign(row, { 'GIA Initial': giaStartOfYear, 'GIA Growth': giaGrowth, 'GIA Value Before Withdrawal': giaValueBeforeWithdrawal, 'Withdraw from GIA': giaWithdrawal, 'GIA Balance': finalGiaBalance });
    
    if (showCash || showIsa || showGia) Object.assign(row, { 'Total Savings Withdrawn': finalTotalSavingsWithdrawn, 'Total Savings Balance': finalCashBalance + finalIsaBalance + finalGiaBalance });

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

    