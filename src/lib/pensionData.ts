
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';

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

    // --- Process contributions and start-of-year values ---
    row['Initial DC Pension'] = dcPot;
    let potThisYear = dcPot;

    const dcContributionThisYear = (age < dcContributionEndAge && annualDcPensionContribution > 0) ? annualDcPensionContribution : 0;
    if (annualDcPensionContribution > 0) row['DC Pension Contribution'] = dcContributionThisYear;
    potThisYear += dcContributionThisYear;

    const cashSavings = { initial: cashPot, contribution: (age < cashContributionEndAge && annualCashContribution > 0) ? annualCashContribution : 0 };
    const isaSavings = { initial: isaPot, contribution: (age < isaContributionEndAge && annualIsaContribution > 0) ? annualIsaContribution : 0 };
    const giaSavings = { initial: giaPot, contribution: (age < giaContributionEndAge && annualGiaContribution > 0) ? annualGiaContribution : 0 };

    // --- RETIREMENT EVENT: LUMP SUM ---
    let dcLumpSumTaken = 0;
    if (age === retirementAge && takeDcLumpSum) {
      dcLumpSumTaken = potThisYear * UFPLS_TAX_FREE_PORTION;
      potThisYear -= dcLumpSumTaken;
    }
    if (takeDcLumpSum) row['DC Lump Sum Taken'] = dcLumpSumTaken;

    // --- Fixed Income Sources ---
    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const fasThisYear = (fasAmount > 0 && age >= fasStartAge) ? fasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = initialOtherIncome > 0 ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    const fixedTaxableIncome = dbPensionThisYear + fasThisYear + statePensionThisYear + otherIncomeThisYear;
    
    // --- Discretionary Withdrawals to meet Target Income ---
    let dcDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    let potAfterContributions = {
      cash: cashSavings.initial + cashSavings.contribution,
      isa: (isaSavings.initial + isaSavings.contribution) * (1 + isaGrowthDecimal),
      gia: (giaSavings.initial + giaSavings.contribution) * (1 + giaGrowthDecimal)
    };
    
    if (isInRetirement && targetAnnualNetIncome > 0) {
        const taxOnFixedIncome = Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
        const netFromFixedIncome = fixedTaxableIncome - taxOnFixedIncome;
        let netShortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);
    
        if (netShortfall > 0) {
            const cashToDraw = Math.min(potAfterContributions.cash, netShortfall);
            cashWithdrawal += cashToDraw;
            netShortfall -= cashToDraw;
        }

        if (netShortfall > 0) {
          const giaToDraw = Math.min(potAfterContributions.gia, netShortfall);
          giaWithdrawal += giaToDraw;
          netShortfall -= giaToDraw;
        }

        if (netShortfall > 0) {
          const isaToDraw = Math.min(potAfterContributions.isa, netShortfall);
          isaWithdrawal += isaToDraw;
          netShortfall -= isaToDraw;
        }

        if (netShortfall > 0 && potThisYear > 0) {
            const taxablePortionRate = takeDcLumpSum ? 1.0 : (1 - UFPLS_TAX_FREE_PORTION);
            const availablePersonalAllowance = Math.max(0, currentPersonalAllowance - fixedTaxableIncome);

            let grossDrawdownRequired = netShortfall;
            const taxablePartOfDraw = grossDrawdownRequired * taxablePortionRate;

            if (taxablePartOfDraw > availablePersonalAllowance) {
                const amountOverAllowance = taxablePartOfDraw - availablePersonalAllowance;
                const netFromTaxablePart = amountOverAllowance * (1 - INCOME_TAX_RATE);
                const grossForTaxablePart = amountOverAllowance / (1 - INCOME_TAX_RATE);
                
                const untaxedPart = netShortfall - netFromTaxablePart;
                grossDrawdownRequired = untaxedPart + grossForTaxablePart;

            } else {
                 grossDrawdownRequired = netShortfall / (1 - (taxablePortionRate * INCOME_TAX_RATE * (fixedTaxableIncome < currentPersonalAllowance ? 1 : 0) ) );
            }
             
            let finalGrossDraw = grossDrawdownRequired;
            const tempTaxableIncome = fixedTaxableIncome + (finalGrossDraw * taxablePortionRate);
            const tempTax = Math.max(0, tempTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
            const tempNet = (fixedTaxableIncome + finalGrossDraw) - tempTax;

            if (tempNet < inflatedTargetNetIncome) {
                finalGrossDraw += (inflatedTargetNetIncome - tempNet);
            }
           
            const draw = Math.min(potThisYear, finalGrossDraw);
            dcDrawdown += draw;
        }
    }

    if (isInRetirement && showDcPension && dcWithdrawalRate > 0) {
      const isSurplusYear = (inflatedTargetNetIncome > 0 && (fixedTaxableIncome >= inflatedTargetNetIncome));
      const noTargetIncome = targetAnnualNetIncome <= 0;
      if (applyDcWithdrawalRateInSurplus && isSurplusYear || noTargetIncome) {
          const remainingDcPotForRate = potThisYear - dcDrawdown;
          if(remainingDcPotForRate > 0){
              const dcStandardWithdrawal = remainingDcPotForRate * (dcWithdrawalRate / 100);
              dcDrawdown += Math.max(0, dcStandardWithdrawal);
          }
      }
    }

    potThisYear -= dcDrawdown;

    // --- Final Pot Calculations ---
    const amcCharge = potThisYear > 0 ? potThisYear * amcDecimal : 0;
    const potAfterAMC = potThisYear - amcCharge;
    const growth = potAfterAMC > 0 ? potAfterAMC * dcGrowthDecimal : 0;
    const finalDcBalance = Math.max(0, potAfterAMC + growth);
    
    dcPot = finalDcBalance;

    const finalCashBalance = potAfterContributions.cash - cashWithdrawal;
    const finalIsaBalance = potAfterContributions.isa - isaWithdrawal;
    const finalGiaBalance = potAfterContributions.gia - giaWithdrawal;

    cashPot = finalCashBalance;
    isaPot = finalIsaBalance;
    giaPot = finalGiaBalance;

    // --- Final Income & Tax ---
    const taxablePensionIncome = dcDrawdown * (takeDcLumpSum ? 1.0 : (1 - UFPLS_TAX_FREE_PORTION));
    const finalTotalTaxableIncome = fixedTaxableIncome + taxablePensionIncome;
    const incomeSubjectToTaxForTable = Math.max(0, finalTotalTaxableIncome - currentPersonalAllowance);
    const finalTaxPaid = incomeSubjectToTaxForTable * INCOME_TAX_RATE;
    const finalTotalSavingsWithdrawn = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const finalTotalGrossIncome = fixedTaxableIncome + dcDrawdown;

    // --- Assign to Row ---
    Object.assign(row, {
        'DC Pension Drawdown': dcDrawdown,
        'DC AMC Charge': amcCharge,
        'DC Pension After Deductions': potAfterAMC,
        'DC Pension Growth': growth,
        'DC Pension Balance': finalDcBalance,
        'TOTAL INCOME': finalTotalGrossIncome + dcLumpSumTaken,
        'Income Subject to Tax': incomeSubjectToTaxForTable,
        'Income Tax Paid': finalTaxPaid,
        'Net Income Per Year': finalTotalGrossIncome + finalTotalSavingsWithdrawn + dcLumpSumTaken - finalTaxPaid,
        'Net Income Per Month': (finalTotalGrossIncome + finalTotalSavingsWithdrawn + dcLumpSumTaken - finalTaxPaid) / 12,
    });
    
    if (initialDbPensionAmount > 0) row['DB Pension'] = dbPensionThisYear;
    if (fasAmount > 0) row['FAS Pension'] = fasThisYear;
    if (initialStatePensionAmount > 0) row['State Pension'] = statePensionThisYear;
    if (initialOtherIncome > 0) row['Other Income'] = otherIncomeThisYear;
    
    if (showCash) {
      Object.assign(row, { 'Cash Savings Initial': cashSavings.initial, 'Withdraw from Cash': cashWithdrawal, 'Cash Savings Balance': finalCashBalance });
      if (annualCashContribution > 0) row['Cash Savings Contribution'] = cashSavings.contribution;
    }
    if (showIsa) {
      Object.assign(row, { 'ISA Initial': isaSavings.initial, 'ISA Growth': potAfterContributions.isa - (isaSavings.initial + isaSavings.contribution), 'ISA Value Before Withdrawal': potAfterContributions.isa, 'Withdraw from ISA': isaWithdrawal, 'ISA Balance': finalIsaBalance });
      if (annualIsaContribution > 0) row['ISA Contribution'] = isaSavings.contribution;
    }
    if (showGia) {
      Object.assign(row, { 'GIA Initial': giaSavings.initial, 'GIA Growth': potAfterContributions.gia - (giaSavings.initial + giaSavings.contribution), 'GIA Value Before Withdrawal': potAfterContributions.gia, 'Withdraw from GIA': giaWithdrawal, 'GIA Balance': finalGiaBalance });
      if (annualGiaContribution > 0) row['GIA Contribution'] = giaSavings.contribution;
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

  return { rows, headers, parameters: params, csvString };
}
