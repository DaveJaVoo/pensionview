
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';

// Helper function to process a generic savings pot year over year
const processSavingsPot = (
  age: number,
  previousBalance: number,
  contribution: number,
  contributionEndAge: number,
  growthRate: number
) => {
  const contributionThisYear = (age < contributionEndAge && contribution > 0) ? contribution : 0;
  const valueAfterContribution = previousBalance + contributionThisYear;
  const growth = growthRate > 0 ? valueAfterContribution * growthRate : 0;
  const valueBeforeWithdrawal = valueAfterContribution + growth;
  return {
    startOfYear: previousBalance,
    contribution: contributionThisYear,
    growth,
    valueBeforeWithdrawal,
  };
};

// Helper function to process the final balance calculation for a pension pot
const calculateFinalPensionBalance = (
  initialBalance: number,
  contribution: number,
  drawdown: number,
  amc: number,
  growthRate: number
) => {
    const potAfterContribution = initialBalance + contribution;
    const potAfterDrawdown = potAfterContribution - drawdown;
    const amcCharge = potAfterDrawdown * amc;
    const afterDeductions = potAfterDrawdown - amcCharge;
    const growth = afterDeductions * growthRate;
    const finalBalance = Math.max(0, afterDeductions + growth);
    return { amcCharge, afterDeductions, growth, finalBalance };
};


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
    initialCashSavings, annualCashContribution, cashContributionEndAge,
    initialIsaAmount, annualIsaContribution, isaContributionEndAge, isaGrowthRate, 
    initialGiaAmount, annualGiaContribution, giaContributionEndAge, giaGrowthRate,
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

  const showCash = initialCashSavings > 0 || annualCashContribution > 0;
  const showIsa = initialIsaAmount > 0 || annualIsaContribution > 0;
  const showGia = initialGiaAmount > 0 || annualGiaContribution > 0;

  if (showCash) {
    headers.push('Cash Savings Initial');
    if (annualCashContribution > 0) headers.push('Cash Savings Contribution');
    headers.push('Withdraw from Cash', 'Cash Savings Balance');
  }
  if (showIsa) {
    headers.push('ISA Initial');
    if (annualIsaContribution > 0) headers.push('ISA Contribution');
    headers.push('ISA Growth', 'ISA Value Before Withdrawal', 'Withdraw from ISA', 'ISA Balance');
  }
  if (showGia) {
    headers.push('GIA Initial');
    if (annualGiaContribution > 0) headers.push('GIA Contribution');
    headers.push('GIA Growth', 'GIA Value Before Withdrawal', 'Withdraw from GIA', 'GIA Balance');
  }

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

  for (let age = currentAge; age <= projectionEndAge; age++) {
    const yearOffset = age - currentAge;
    const currentYear = calculationTriggerYear + yearOffset;
    const isInRetirement = age >= retirementAge;

    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);
    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);

    const row: PensionDataRow = { Age: age, Year: String(currentYear) };
    
    // --- Process Savings Pots (Cash, ISA, GIA) ---
    const cashPot = processSavingsPot(age, previousRow?.['Cash Savings Balance'] ?? initialCashSavings, annualCashContribution, cashContributionEndAge, 0);
    const isaPot = processSavingsPot(age, previousRow?.['ISA Balance'] ?? initialIsaAmount, annualIsaContribution, isaContributionEndAge, isaGrowthDecimal);
    const giaPot = processSavingsPot(age, previousRow?.['GIA Balance'] ?? initialGiaAmount, annualGiaContribution, giaContributionEndAge, giaGrowthDecimal);

    // --- Process Pension Pots (DC, SIPP) ---
    const getPensionPotStartValue = (potType: 'DC' | 'SIPP'): number => {
      if (previousRow) {
          return potType === 'DC' 
              ? (previousRow['DC Pension Balance'] ?? 0)
              : (previousRow['SIPP Balance'] ?? 0);
      }
      return potType === 'DC' ? actualInitialDcPensionForProjection : actualInitialSippForProjection;
  };
    
    const dcPotStartValue = getPensionPotStartValue('DC');
    const sippPotStartValue = getPensionPotStartValue('SIPP');
    const dcContributionThisYear = (age < dcContributionEndAge && annualDcPensionContribution > 0) ? annualDcPensionContribution : 0;
    const sippContributionThisYear = (age < sippContributionEndAge && annualSippContribution > 0) ? annualSippContribution : 0;

    row['Initial DC Pension'] = dcPotStartValue;
    row['DC Pension Contribution'] = dcContributionThisYear;
    row['Initial SIPP'] = sippPotStartValue;
    row['SIPP Contribution'] = sippContributionThisYear;

    // --- Non-Discretionary Income First ---
    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = initialOtherIncome > 0 ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    const fasThisYear = (initialFasAmount > 0 && age >= fasStartAge) ? initialFasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;
    
    const fixedTaxableIncome = dbPensionThisYear + statePensionThisYear + otherIncomeThisYear + fasThisYear;

    // --- WITHDRAWAL WATERFALL ---
    let dcDrawdown = 0;
    let sippDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    if (isInRetirement) {
        const taxOnFixedIncome = Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
        const netFromFixedIncome = fixedTaxableIncome - taxOnFixedIncome;
        let netShortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);
    
        // 1. Cash (no growth, no tax)
        const cashToDraw = Math.min(cashPot.valueBeforeWithdrawal, netShortfall);
        cashWithdrawal += cashToDraw;
        netShortfall -= cashToDraw;

        // 2. GIA (tax on growth not modeled, so treated as post-tax)
        if (netShortfall > 0) {
          const giaToDraw = Math.min(giaPot.valueBeforeWithdrawal, netShortfall);
          giaWithdrawal += giaToDraw;
          netShortfall -= giaToDraw;
        }

        // 3. ISA (tax-free wrapper, preserve as long as possible)
        if (netShortfall > 0) {
          const isaToDraw = Math.min(isaPot.valueBeforeWithdrawal, netShortfall);
          isaWithdrawal += isaToDraw;
          netShortfall -= isaToDraw;
        }

        // 4. Pensions (if still a shortfall) - Tax-Optimized
        if (netShortfall > 0.01) {
            const dcPot = { balance: dcPotStartValue, contribution: dcContributionThisYear, amc: annualChargeAMC/100, growthRate: investmentPercentageGrowth/100, type: 'DC' };
            const sippPot = { balance: sippPotStartValue, contribution: sippContributionThisYear, amc: sippAnnualChargeAMC/100, growthRate: sippInvestmentPercentageGrowth/100, type: 'SIPP' };

            // Drawdown from the most expensive/worst performing pension first to preserve the best assets
            const pensionDrawdownOrder = [dcPot, sippPot]
              .filter(p => p.balance > 0 || p.contribution > 0)
              .sort((a, b) => b.amc - a.amc || a.growthRate - b.growthRate || a.balance - b.balance);
          
            let totalTaxableIncomeSoFar = fixedTaxableIncome;

            for (const pot of pensionDrawdownOrder) {
                if (netShortfall <= 0.01) break;
              
                const potBalance = pot.balance + pot.contribution;
                const takeLumpSum = pot.type === 'DC' ? takeTaxFreeLumpSum : takeSippTaxFreeLumpSum;
                const ufplsTaxFreePortion = takeLumpSum ? 0 : UFPLS_TAX_FREE_PORTION;
                const taxablePortionRate = 1 - ufplsTaxFreePortion;
              
                // This is the key tax calculation: we need to find the gross withdrawal (X)
                // such that X - (TaxablePortion(X) * TaxRate) = NetShortfall.
                // X - (X * taxablePortionRate * INCOME_TAX_RATE) = NetShortfall
                // X * (1 - taxablePortionRate * INCOME_TAX_RATE) = NetShortfall
                // X = NetShortfall / (1 - taxablePortionRate * INCOME_TAX_RATE)
                // This calculation is slightly simplified as it doesn't account for the personal allowance being used up by this withdrawal itself,
                // but it's a very close approximation for basic rate tax scenarios.
                const grossWithdrawalNeededForNet = netShortfall / (1 - (taxablePortionRate * INCOME_TAX_RATE));

                let draw = Math.min(potBalance, grossWithdrawalNeededForNet);
                draw = Math.max(0, draw);

                const taxablePartOfDraw = draw * taxablePortionRate;
                const taxOnThisDraw = Math.max(0, (totalTaxableIncomeSoFar + taxablePartOfDraw) - currentPersonalAllowance) * INCOME_TAX_RATE - Math.max(0, totalTaxableIncomeSoFar - currentPersonalAllowance) * INCOME_TAX_RATE;
                const netFromThisDraw = draw - taxOnThisDraw;

                if (pot.type === 'DC') dcDrawdown += draw;
                else sippDrawdown += draw;
                
                totalTaxableIncomeSoFar += taxablePartOfDraw;
                netShortfall -= netFromThisDraw;
            }
        }

        const isSurplusYear = netShortfall <= 0;
        if (isSurplusYear) {
            if (applyDcWithdrawalRateInSurplus && showDcPension) {
                const dcStandardWithdrawal = (dcPotStartValue + dcContributionThisYear - dcDrawdown) * (dcWithdrawalRate / 100);
                dcDrawdown += Math.max(0, dcStandardWithdrawal);
            }
            if (applySippWithdrawalRateInSurplus && showSipp) {
                const sippStandardWithdrawal = (sippPotStartValue + sippContributionThisYear - sippDrawdown) * (sippWithdrawalRate / 100);
                sippDrawdown += Math.max(0, sippStandardWithdrawal);
            }
        }
    }
    
    // --- PENSION FINAL CALCULATIONS ---
    const dcFinals = calculateFinalPensionBalance(dcPotStartValue, dcContributionThisYear, dcDrawdown, annualChargeAMC / 100, investmentPercentageGrowth / 100);
    const sippFinals = calculateFinalPensionBalance(sippPotStartValue, sippContributionThisYear, sippDrawdown, sippAnnualChargeAMC / 100, sippInvestmentPercentageGrowth / 100);

    // --- FINAL TALLY ---
    const finalTotalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const finalGrossPensionDrawdown = dcDrawdown + sippDrawdown;

    const taxableDcPensionIncome = dcDrawdown * (takeTaxFreeLumpSum ? 1 : (1 - UFPLS_TAX_FREE_PORTION));
    const taxableSippPensionIncome = sippDrawdown * (takeSippTaxFreeLumpSum ? 1 : (1 - UFPLS_TAX_FREE_PORTION));
    const taxablePensionIncome = taxableDcPensionIncome + taxableSippPensionIncome;

    const finalTotalTaxableIncome = fixedTaxableIncome + taxablePensionIncome;
    const incomeSubjectToTaxForTable = Math.max(0, finalTotalTaxableIncome - currentPersonalAllowance);
    const finalTaxPaid = incomeSubjectToTaxForTable * INCOME_TAX_RATE;
    
    const finalTotalGrossIncome = fixedTaxableIncome + finalGrossPensionDrawdown;
    const finalNetIncome = finalTotalGrossIncome - finalTaxPaid;
    
    row['TOTAL INCOME'] = finalTotalGrossIncome;
    row['Income Subject to Tax'] = incomeSubjectToTaxForTable;
    row['Income Tax Paid'] = finalTaxPaid;
    row['Net Income Per Year'] = finalNetIncome + finalTotalSavingsWithdrawn;
    row['Net Income Per Month'] = (finalNetIncome + finalTotalSavingsWithdrawn) / 12;

    const finalCashBalance = cashPot.valueBeforeWithdrawal - cashWithdrawal;
    const finalIsaBalance = isaPot.valueBeforeWithdrawal - isaWithdrawal;
    const finalGiaBalance = giaPot.valueBeforeWithdrawal - giaWithdrawal;
    
    if (showDcPension) Object.assign(row, { 'DC Pension Drawdown': dcDrawdown, 'DC AMC Charge': dcFinals.amcCharge, 'DC Pension After Deductions': dcFinals.afterDeductions, 'DC Pension Growth': dcFinals.growth, 'DC Pension Balance': dcFinals.finalBalance });
    if (showSipp) Object.assign(row, { 'SIPP Drawdown': sippDrawdown, 'SIPP AMC Charge': sippFinals.amcCharge, 'SIPP After Deductions': sippFinals.afterDeductions, 'SIPP Growth': sippFinals.growth, 'SIPP Balance': sippFinals.finalBalance });
    
    if (initialDbPensionAmount > 0) row['DB Pension'] = dbPensionThisYear;
    if (initialStatePensionAmount > 0) row['State Pension'] = statePensionThisYear;
    if (initialOtherIncome > 0) row['Other Income'] = otherIncomeThisYear;
    if (initialFasAmount > 0) row['FAS'] = fasThisYear;
    
    if (showCash) {
      Object.assign(row, { 'Cash Savings Initial': cashPot.startOfYear, 'Withdraw from Cash': cashWithdrawal, 'Cash Savings Balance': finalCashBalance });
      if (annualCashContribution > 0) row['Cash Savings Contribution'] = cashPot.contribution;
    }
    if (showIsa) {
      Object.assign(row, { 'ISA Initial': isaPot.startOfYear, 'ISA Growth': isaPot.growth, 'ISA Value Before Withdrawal': isaPot.valueBeforeWithdrawal, 'Withdraw from ISA': isaWithdrawal, 'ISA Balance': finalIsaBalance });
      if (annualIsaContribution > 0) row['ISA Contribution'] = isaPot.contribution;
    }
    if (showGia) {
      Object.assign(row, { 'GIA Initial': giaPot.startOfYear, 'GIA Growth': giaPot.growth, 'GIA Value Before Withdrawal': giaPot.valueBeforeWithdrawal, 'Withdraw from GIA': giaWithdrawal, 'GIA Balance': finalGiaBalance });
      if (annualGiaContribution > 0) row['GIA Contribution'] = giaPot.contribution;
    }
    
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

    
