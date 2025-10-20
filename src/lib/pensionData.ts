
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
  let lumpSumAmountTaken = 0;
  
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

    // --- START OF YEAR ---
    
    // --- Contributions (happen at start of year) ---
    const dcContributionThisYear = (age < dcContributionEndAge && annualDcPensionContribution > 0) ? annualDcPensionContribution : 0;
    if (annualDcPensionContribution > 0) row['DC Pension Contribution'] = dcContributionThisYear;
    dcPot += dcContributionThisYear;

    // --- Lump Sum Calculation at Retirement Age (happens after final contribution) ---
    let dcLumpSumThisYear = 0;
    if (age === retirementAge && takeDcLumpSum && dcPot > 0) {
        dcLumpSumThisYear = dcPot * UFPLS_TAX_FREE_PORTION;
        lumpSumAmountTaken = dcLumpSumThisYear;
        dcPot -= dcLumpSumThisYear;
    }
    
    // --- Record initial pot values for the year (AFTER lump sum) ---
    row['Initial DC Pension'] = dcPot;

    let dcPotForYear = dcPot;

    // --- Savings Pots initial values and contributions ---
    row['Cash Savings Initial'] = cashPot;
    const cashContribution = (age < cashContributionEndAge && annualCashContribution > 0) ? annualCashContribution : 0;
    if(annualCashContribution > 0) row['Cash Savings Contribution'] = cashContribution;
    let cashPotThisYear = cashPot + cashContribution;

    row['ISA Initial'] = isaPot;
    const isaContribution = (age < isaContributionEndAge && annualIsaContribution > 0) ? annualIsaContribution : 0;
    if(annualIsaContribution > 0) row['ISA Contribution'] = isaContribution;
    let isaPotThisYear = isaPot + isaContribution;
    const isaGrowth = isaPotThisYear * isaGrowthDecimal;
    isaPotThisYear += isaGrowth;
    row['ISA Growth'] = isaGrowth;
    row['ISA Value Before Withdrawal'] = isaPotThisYear;
    
    row['GIA Initial'] = giaPot;
    const giaContribution = (age < giaContributionEndAge && annualGiaContribution > 0) ? annualGiaContribution : 0;
    if(annualGiaContribution > 0) row['GIA Contribution'] = giaContribution;
    let giaPotThisYear = giaPot + giaContribution;
    const giaGrowth = giaPotThisYear * giaGrowthDecimal;
    giaPotThisYear += giaGrowth;
    row['GIA Growth'] = giaGrowth;
    row['GIA Value Before Withdrawal'] = giaPotThisYear;
    
    // --- Fixed Income sources ---
    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const fasThisYear = (fasAmount > 0 && age >= fasStartAge) ? fasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = initialOtherIncome > 0 ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    const fixedTaxableIncome = dbPensionThisYear + fasThisYear + statePensionThisYear + otherIncomeThisYear;
    
    // --- Calculate required withdrawals to meet target income ---
    let dcDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    if (isInRetirement && targetAnnualNetIncome > 0) {
        const taxOnFixedIncome = Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
        const netFromFixedIncome = fixedTaxableIncome - taxOnFixedIncome;
        let netShortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);
    
        if (netShortfall > 0) {
            const cashToDraw = Math.min(cashPotThisYear, netShortfall);
            cashWithdrawal = cashToDraw;
            cashPotThisYear -= cashToDraw;
            netShortfall -= cashToDraw;
        }

        if (netShortfall > 0) {
          const giaToDraw = Math.min(giaPotThisYear, netShortfall);
          giaWithdrawal = giaToDraw;
          giaPotThisYear -= giaToDraw;
          netShortfall -= giaToDraw;
        }

        if (netShortfall > 0) {
          const isaToDraw = Math.min(isaPotThisYear, netShortfall);
          isaWithdrawal = isaToDraw;
          isaPotThisYear -= isaToDraw;
          netShortfall -= isaToDraw;
        }

        if (netShortfall > 0 && dcPotForYear > 0) {
            const taxablePortionRate = takeDcLumpSum ? 1.0 : (1 - UFPLS_TAX_FREE_PORTION);
            const effectiveTaxRate = taxablePortionRate * INCOME_TAX_RATE;
            const grossDrawdownRequired = netShortfall / (1 - effectiveTaxRate);
            dcDrawdown = Math.min(dcPotForYear, grossDrawdownRequired);
        }
    }
    
    // --- Standard DC withdrawal rate if surplus or no target ---
    if (isInRetirement && showDcPension && dcWithdrawalRate > 0) {
      const netFromFixedIncome = fixedTaxableIncome - Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
      const isSurplusYear = (targetAnnualNetIncome > 0 && (netFromFixedIncome >= inflatedTargetNetIncome));
      const noTargetIncome = targetAnnualNetIncome <= 0;
      
      const availableDcForStandardWithdrawal = dcPotForYear - dcDrawdown;

      if (availableDcForStandardWithdrawal > 0 && (noTargetIncome || (isSurplusYear && applyDcWithdrawalRateInSurplus))) {
        const standardWithdrawal = availableDcForStandardWithdrawal * (dcWithdrawalRate / 100);
        dcDrawdown += standardWithdrawal;
      }
    }
    dcDrawdown = Math.min(dcPotForYear, dcDrawdown);
    
    // --- Apply DC deductions and growth ---
    dcPotForYear -= dcDrawdown;

    const amcCharge = dcPotForYear * amcDecimal;
    row['DC AMC Charge'] = amcCharge;
    const dcPotAfterDeductions = dcPotForYear - amcCharge;
    row['DC Pension After Deductions'] = dcPotAfterDeductions;

    const dcGrowth = dcPotAfterDeductions * dcGrowthDecimal;
    row['DC Pension Growth'] = dcGrowth;
    
    // --- Finalize balances for next year ---
    dcPot = dcPotAfterDeductions + dcGrowth;
    row['DC Pension Balance'] = dcPot;

    cashPot = cashPotThisYear;
    isaPot = isaPotThisYear;
    giaPot = giaPotThisYear;
    
    row['Withdraw from Cash'] = cashWithdrawal;
    row['Withdraw from ISA'] = isaWithdrawal;
    row['Withdraw from GIA'] = giaWithdrawal;
    row['Cash Savings Balance'] = cashPot;
    row['ISA Balance'] = isaPot;
    row['GIA Balance'] = giaPot;

    const taxableDcIncome = takeDcLumpSum ? dcDrawdown : (dcDrawdown * (1 - UFPLS_TAX_FREE_PORTION));
    const totalTaxableIncome = fixedTaxableIncome + taxableDcIncome;
    const incomeSubjectToTaxForTable = Math.max(0, totalTaxableIncome - currentPersonalAllowance);
    const taxPaid = incomeSubjectToTaxForTable * INCOME_TAX_RATE;
    
    const nonTaxableDcIncome = takeDcLumpSum ? 0 : (dcDrawdown * UFPLS_TAX_FREE_PORTION);
    const totalGrossIncome = fixedTaxableIncome + dcDrawdown + dcLumpSumThisYear;
    const totalSavingsWithdrawal = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const totalNetIncome = (totalTaxableIncome - taxPaid) + nonTaxableDcIncome + dcLumpSumThisYear + totalSavingsWithdrawal;

    Object.assign(row, {
        'DC Pension Drawdown': dcDrawdown,
        'TOTAL INCOME': totalGrossIncome,
        'Income Subject to Tax': incomeSubjectToTaxForTable,
        'Income Tax Paid': taxPaid,
        'Net Income Per Year': totalNetIncome,
        'Net Income Per Month': totalNetIncome / 12,
    });
    
    if (initialDbPensionAmount > 0) row['DB Pension'] = dbPensionThisYear;
    if (fasAmount > 0) row['FAS Pension'] = fasThisYear;
    if (initialStatePensionAmount > 0) row['State Pension'] = statePensionThisYear;
    if (initialOtherIncome > 0) row['Other Income'] = otherIncomeThisYear;
    if (showCash || showIsa || showGia) Object.assign(row, { 'Total Savings Withdrawn': totalSavingsWithdrawal, 'Total Savings Balance': cashPot + isaPot + giaPot });

    // Final formatting
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

  return { rows, headers, parameters: params, csvString, lumpSumAmount: lumpSumAmountTaken };
}
