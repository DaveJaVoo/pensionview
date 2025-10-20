
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

export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, retirementAge, projectionEndAge, targetAnnualNetIncome, calculationTriggerYear,
    initialDbPensionAmount, dbPensionStartAge,
    fasAmount, fasStartAge,
    statePensionAge, initialStatePensionAmount,
    initialOtherIncome,
    
    initialDcPensionValue,
    annualDcPensionContribution, dcContributionEndAge,
    investmentPercentageGrowth, dcWithdrawalRate, annualChargeAMC,
    applyDcWithdrawalRateInSurplus, takeDcLumpSum,
    
    inflationRate,
    initialCashSavings, annualCashContribution, cashContributionEndAge,
    initialIsaAmount, annualIsaContribution, isaContributionEndAge, isaGrowthRate, 
    initialGiaAmount, annualGiaContribution, giaContributionEndAge, giaGrowthRate,
  } = params;
  
  const headers: string[] = ['Age', 'Year'];
  const showDcPension = initialDcPensionValue > 0 || annualDcPensionContribution > 0;
  const showFas = fasAmount > 0;

  if (showDcPension) {
    const dcHeaders = ['Initial DC Pension'];
    if (annualDcPensionContribution > 0) dcHeaders.push('DC Pension Contribution');
     if (takeDcLumpSum) dcHeaders.push('DC Lump Sum Taken');
    dcHeaders.push('DC Pension Drawdown', 'DC AMC Charge', 'DC Pension After Deductions', 'DC Pension Growth', 'DC Pension Balance');
    headers.splice(2, 0, ...dcHeaders);
  }

  const otherIncomeSources = [
    { amount: initialDbPensionAmount, header: 'DB Pension' },
    { amount: initialStatePensionAmount, header: 'State Pension' },
    { amount: initialOtherIncome, header: 'Other Income' },
  ];
  if (showFas) {
      otherIncomeSources.splice(1, 0, { amount: fasAmount, header: 'FAS Pension' });
  }

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
  
  let dcPot = initialDcPensionValue;
  let cashPot = initialCashSavings;
  let isaPot = initialIsaAmount;
  let giaPot = initialGiaAmount;
  
  const inflationDecimal = (inflationRate || 0) / 100;
  const isaGrowthDecimal = (isaGrowthRate || 0) / 100;
  const giaGrowthDecimal = (giaGrowthRate || 0) / 100;
  const dcGrowthDecimal = investmentPercentageGrowth / 100;
  const amcDecimal = annualChargeAMC / 100;

  for (let age = currentAge; age <= projectionEndAge; age++) {
    const yearOffset = age - currentAge;
    const currentYear = calculationTriggerYear + yearOffset;
    const isInRetirement = age >= retirementAge;

    const row: PensionDataRow = { Age: age, Year: String(currentYear) };

    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);
    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);

    // --- Contributions & Pot Values at Start of Year ---
    row['Initial DC Pension'] = dcPot;
    let dcPotBeforeDrawdown = dcPot;

    const dcContributionThisYear = (age < dcContributionEndAge && annualDcPensionContribution > 0) ? annualDcPensionContribution : 0;
    if (annualDcPensionContribution > 0) {
      row['DC Pension Contribution'] = dcContributionThisYear;
      dcPotBeforeDrawdown += dcContributionThisYear;
    }

    const cashSavings = processSavingsPot(age, cashPot, annualCashContribution, cashContributionEndAge, 0);
    const isaSavings = processSavingsPot(age, isaPot, annualIsaContribution, isaContributionEndAge, isaGrowthDecimal);
    const giaSavings = processSavingsPot(age, giaPot, annualGiaContribution, giaContributionEndAge, giaGrowthDecimal);
    
    // --- Take Lump Sum at Retirement ---
    let dcLumpSumTaken = 0;
    if (age === retirementAge && takeDcLumpSum) {
      const potForLumpSum = dcPotBeforeDrawdown; // The value before any growth/charges for the current year
      dcLumpSumTaken = potForLumpSum * UFPLS_TAX_FREE_PORTION;
      dcPotBeforeDrawdown -= dcLumpSumTaken; // Reduce the pot immediately
    }
    row['DC Lump Sum Taken'] = dcLumpSumTaken;

    // --- Non-Discretionary Income ---
    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const fasThisYear = (fasAmount > 0 && age >= fasStartAge) ? fasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = initialOtherIncome > 0 ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    
    const fixedTaxableIncome = dbPensionThisYear + fasThisYear + statePensionThisYear + otherIncomeThisYear;

    // --- Discretionary Withdrawals ---
    let dcDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    if (isInRetirement) {
        const taxOnFixedIncome = Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
        const netFromFixedIncome = fixedTaxableIncome - taxOnFixedIncome;
        let netShortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);
    
        if (netShortfall > 0) {
            const cashToDraw = Math.min(cashSavings.valueBeforeWithdrawal, netShortfall);
            cashWithdrawal += cashToDraw;
            netShortfall -= cashToDraw;
        }

        if (netShortfall > 0) {
          const giaToDraw = Math.min(giaSavings.valueBeforeWithdrawal, netShortfall);
          giaWithdrawal += giaToDraw;
          netShortfall -= giaToDraw;
        }

        if (netShortfall > 0) {
          const isaToDraw = Math.min(isaSavings.valueBeforeWithdrawal, netShortfall);
          isaWithdrawal += isaToDraw;
          netShortfall -= isaToDraw;
        }

        if (netShortfall > 0.01 && dcPotBeforeDrawdown > 0) {
            const taxablePortionRate = takeDcLumpSum ? 1.0 : (1 - UFPLS_TAX_FREE_PORTION);
            const taxRateForThisDraw = INCOME_TAX_RATE;
            const availablePersonalAllowance = Math.max(0, currentPersonalAllowance - fixedTaxableIncome);

            // Gross-up calculation
            let grossDrawdownRequired = netShortfall;
            const taxablePart = grossDrawdownRequired * taxablePortionRate;
            if (taxablePart > availablePersonalAllowance) {
                const amountOverAllowance = taxablePart - availablePersonalAllowance;
                const netFromTaxablePart = amountOverAllowance * (1 - taxRateForThisDraw);
                const grossForTaxablePart = amountOverAllowance / (1 - taxRateForThisDraw);
                
                const untaxedPart = taxablePart - amountOverAllowance;
                
                grossDrawdownRequired = (netShortfall - untaxedPart) / (1-taxRateForThisDraw) + untaxedPart;

            }
            
            // Simplified gross-up
            let grossDrawRequiredForNet = netShortfall;
            let taxToPayOnGross = Math.max(0, ((fixedTaxableIncome + (grossDrawRequiredForNet * taxablePortionRate)) - currentPersonalAllowance) * taxRateForThisDraw) - taxOnFixedIncome;
            grossDrawRequiredForNet = netShortfall + taxToPayOnGross;

            const draw = Math.min(dcPotBeforeDrawdown, grossDrawRequiredForNet);
            dcDrawdown += draw;
        }

        const isSurplusYear = inflatedTargetNetIncome > 0 && netShortfall <= 0;
        if ((isSurplusYear && applyDcWithdrawalRateInSurplus && showDcPension) || (inflatedTargetNetIncome === 0 && showDcPension && dcWithdrawalRate > 0)) {
            const remainingDcPot = dcPotBeforeDrawdown - dcDrawdown;
            if(remainingDcPot > 0){
                const dcStandardWithdrawal = remainingDcPot * (dcWithdrawalRate / 100);
                dcDrawdown += Math.max(0, dcStandardWithdrawal);
            }
        }
    }
    row['DC Pension Drawdown'] = dcDrawdown;
    
    // --- Final Pot Calculations for the year ---
    const potAfterDrawdown = dcPotBeforeDrawdown - dcDrawdown;
    const amcCharge = potAfterDrawdown > 0 ? potAfterDrawdown * amcDecimal : 0;
    const afterDeductions = potAfterDrawdown - amcCharge;
    const growth = afterDeductions > 0 ? afterDeductions * dcGrowthDecimal : 0;
    const finalDcBalance = Math.max(0, afterDeductions + growth);
    
    dcPot = finalDcBalance; // Update main variable for next loop iteration
    
    row['DC AMC Charge'] = amcCharge;
    row['DC Pension After Deductions'] = afterDeductions;
    row['DC Pension Growth'] = growth;
    row['DC Pension Balance'] = finalDcBalance;

    const finalCashBalance = cashSavings.valueBeforeWithdrawal - cashWithdrawal;
    const finalIsaBalance = isaSavings.valueBeforeWithdrawal - isaWithdrawal;
    const finalGiaBalance = giaSavings.valueBeforeWithdrawal - giaWithdrawal;

    cashPot = finalCashBalance;
    isaPot = finalIsaBalance;
    giaPot = finalGiaBalance;

    // --- Final Income & Tax Calculations ---
    const taxablePensionIncome = dcDrawdown * (takeDcLumpSum ? 1.0 : (1 - UFPLS_TAX_FREE_PORTION));
    const finalTotalTaxableIncome = fixedTaxableIncome + taxablePensionIncome;
    const incomeSubjectToTaxForTable = Math.max(0, finalTotalTaxableIncome - currentPersonalAllowance);
    const finalTaxPaid = incomeSubjectToTaxForTable * INCOME_TAX_RATE;
    
    const finalTotalGrossIncome = fixedTaxableIncome + dcDrawdown;
    const finalNetIncomeFromTaxableSources = finalTotalGrossIncome - finalTaxPaid;
    const finalTotalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;

    row['TOTAL INCOME'] = finalTotalGrossIncome + dcLumpSumTaken;
    row['Income Subject to Tax'] = incomeSubjectToTaxForTable;
    row['Income Tax Paid'] = finalTaxPaid;
    row['Net Income Per Year'] = finalNetIncomeFromTaxableSources + finalTotalSavingsWithdrawn + dcLumpSumTaken;
    row['Net Income Per Month'] = row['Net Income Per Year'] / 12;

    // --- Assign other values to the row for display ---
    if (initialDbPensionAmount > 0) row['DB Pension'] = dbPensionThisYear;
    if (fasAmount > 0) row['FAS Pension'] = fasThisYear;
    if (initialStatePensionAmount > 0) row['State Pension'] = statePensionThisYear;
    if (initialOtherIncome > 0) row['Other Income'] = otherIncomeThisYear;
    
    if (showCash) {
      Object.assign(row, { 'Cash Savings Initial': cashSavings.startOfYear, 'Withdraw from Cash': cashWithdrawal, 'Cash Savings Balance': finalCashBalance });
      if (annualCashContribution > 0) row['Cash Savings Contribution'] = cashSavings.contribution;
    }
    if (showIsa) {
      Object.assign(row, { 'ISA Initial': isaSavings.startOfYear, 'ISA Growth': isaSavings.growth, 'ISA Value Before Withdrawal': isaSavings.valueBeforeWithdrawal, 'Withdraw from ISA': isaWithdrawal, 'ISA Balance': finalIsaBalance });
      if (annualIsaContribution > 0) row['ISA Contribution'] = isaSavings.contribution;
    }
    if (showGia) {
      Object.assign(row, { 'GIA Initial': giaSavings.startOfYear, 'GIA Growth': giaSavings.growth, 'GIA Value Before Withdrawal': giaSavings.valueBeforeWithdrawal, 'Withdraw from GIA': giaWithdrawal, 'GIA Balance': finalGiaBalance });
      if (annualGiaContribution > 0) row['GIA Contribution'] = giaSavings.contribution;
    }
    
    if (showCash || showIsa || showGia) Object.assign(row, { 'Total Savings Withdrawn': finalTotalSavingsWithdrawn, 'Total Savings Balance': finalCashBalance + finalIsaBalance + finalGiaBalance });

    // --- Final formatting ---
    headers.forEach(header => {
      const val = row[header];
      if (typeof val === 'number') {
        row[header] = parseFloat(val.toFixed(2));
        if (isNaN(row[header] as number)) row[header] = 0;
      }
    });

    rows.push(row);
  }

  const outputParameters = { ...params };

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
