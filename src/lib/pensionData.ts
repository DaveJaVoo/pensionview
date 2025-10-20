import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';

export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, retirementAge, projectionEndAge, targetAnnualNetIncome, calculationTriggerYear,
    initialDbPensionAmount, dbPensionStartAge,
    fasAmount, fasStartAge,
    statePensionAge, initialStatePensionAmount,
    initialOtherIncome,
    
    // DC Pension
    initialDcPensionValue, annualDcContribution, dcContributionEndAge, dcGrowthRate, dcAnnualManagementCharge,

    // SIPP
    initialSippValue, annualSippContribution, sippContributionEndAge, sippGrowthRate, sippWithdrawalRate, 
    sippAnnualManagementCharge, applySippWithdrawalRateInSurplus, takeSippLumpSum,
    
    inflationRate,
    initialCashSavings, annualCashContribution, cashContributionEndAge,
    initialIsaAmount, annualIsaContribution, isaContributionEndAge, isaGrowthRate, 
    initialGiaAmount, annualGiaContribution, giaContributionEndAge, giaGrowthRate,
  } = params;
  
  const headers: string[] = ['Age', 'Year'];
  const showSipp = initialSippValue > 0 || annualSippContribution > 0;
  const showDc = initialDcPensionValue > 0 || annualDcContribution > 0;
  const showFas = fasAmount > 0;

  if (showDc) {
    const dcHeaders = ['Initial DC'];
    if (annualDcContribution > 0) dcHeaders.push('DC Contribution');
    dcHeaders.push('DC Drawdown', 'DC AMC Charge', 'DC After Deductions', 'DC Growth', 'DC Balance');
    headers.splice(2, 0, ...dcHeaders);
  }

  if (showSipp) {
    const sippHeaders = ['Initial SIPP'];
    if (annualSippContribution > 0) sippHeaders.push('SIPP Contribution');
    sippHeaders.push('SIPP Drawdown', 'SIPP AMC Charge', 'SIPP After Deductions', 'SIPP Growth', 'SIPP Balance');
    headers.splice(2, 0, ...sippHeaders);
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
  
  let sippPot = initialSippValue;
  let dcPot = initialDcPensionValue;
  let cashPot = initialCashSavings;
  let isaPot = initialIsaAmount;
  let giaPot = initialGiaAmount;
  let lumpSumAmountTaken = 0;
  let sippLumpSumThisYear = 0;
  
  const inflationDecimal = (inflationRate || 0) / 100;
  const isaGrowthDecimal = (isaGrowthRate || 0) / 100;
  const giaGrowthDecimal = (giaGrowthRate || 0) / 100;
  const sippGrowthDecimal = sippGrowthRate / 100;
  const dcGrowthDecimal = dcGrowthRate / 100;
  const sippAmcDecimal = sippAnnualManagementCharge / 100;
  const dcAmcDecimal = dcAnnualManagementCharge / 100;

  for (let age = currentAge; age <= projectionEndAge; age++) {
    const yearOffset = age - currentAge;
    const currentYear = calculationTriggerYear + yearOffset;
    const isInRetirement = age >= retirementAge;
    const row: PensionDataRow = { Age: age, Year: String(currentYear) };

    const currentPersonalAllowance = PERSONAL_ALLOWANCE * Math.pow(1 + inflationDecimal, yearOffset);
    const inflatedTargetNetIncome = targetAnnualNetIncome * Math.pow(1 + inflationDecimal, yearOffset);
    
    // --- LUMP SUM & CONTRIBUTIONS ---
    if (age === retirementAge && takeSippLumpSum === true && sippPot > 0) {
        sippLumpSumThisYear = sippPot * UFPLS_TAX_FREE_PORTION;
        lumpSumAmountTaken = sippLumpSumThisYear;
        sippPot -= sippLumpSumThisYear;
    } else {
        sippLumpSumThisYear = 0;
    }
    
    if (showSipp) {
        row['Initial SIPP'] = sippPot;
        const sippContributionThisYear = (age < sippContributionEndAge && annualSippContribution > 0) ? annualSippContribution : 0;
        if (annualSippContribution > 0) row['SIPP Contribution'] = sippContributionThisYear;
        sippPot += sippContributionThisYear;
    }
    
    if (showDc) {
        row['Initial DC'] = dcPot;
        const dcContributionThisYear = (age < dcContributionEndAge && annualDcContribution > 0) ? annualDcContribution : 0;
        if (annualDcContribution > 0) row['DC Contribution'] = dcContributionThisYear;
        dcPot += dcContributionThisYear;
    }


    // --- Savings Pots initial values and contributions ---
    let cashPotThisYear = cashPot;
    if(showCash) {
      row['Cash Savings Initial'] = cashPot;
      const cashContribution = (age < cashContributionEndAge && annualCashContribution > 0) ? annualCashContribution : 0;
      if(annualCashContribution > 0) row['Cash Savings Contribution'] = cashContribution;
      cashPotThisYear += cashContribution;
    }
    
    let isaPotThisYear = isaPot;
    if(showIsa) {
      row['ISA Initial'] = isaPot;
      const isaContribution = (age < isaContributionEndAge && annualIsaContribution > 0) ? annualIsaContribution : 0;
      if(annualIsaContribution > 0) row['ISA Contribution'] = isaContribution;
      const isaPotBeforeGrowth = isaPot + isaContribution;
      const isaGrowth = isaPotBeforeGrowth * isaGrowthDecimal;
      isaPotThisYear = isaPotBeforeGrowth + isaGrowth;
      row['ISA Growth'] = isaGrowth;
      row['ISA Value Before Withdrawal'] = isaPotThisYear;
    }

    let giaPotThisYear = giaPot;
    if(showGia) {
      row['GIA Initial'] = giaPot;
      const giaContribution = (age < giaContributionEndAge && annualGiaContribution > 0) ? annualGiaContribution : 0;
      if(annualGiaContribution > 0) row['GIA Contribution'] = giaContribution;
      const giaPotBeforeGrowth = giaPot + giaContribution;
      const giaGrowth = giaPotBeforeGrowth * giaGrowthDecimal;
      giaPotThisYear = giaPotBeforeGrowth + giaGrowth;
      row['GIA Growth'] = giaGrowth;
      row['GIA Value Before Withdrawal'] = giaPotThisYear;
    }
        
    // --- Fixed Income sources ---
    const dbPensionThisYear = (initialDbPensionAmount > 0 && age >= dbPensionStartAge) ? initialDbPensionAmount * Math.pow(1 + inflationDecimal, age - dbPensionStartAge) : 0;
    const fasThisYear = (fasAmount > 0 && age >= fasStartAge) ? fasAmount * Math.pow(1 + inflationDecimal, age - fasStartAge) : 0;
    const statePensionThisYear = (initialStatePensionAmount > 0 && age >= statePensionAge) ? initialStatePensionAmount * Math.pow(1 + inflationDecimal, age - statePensionAge) : 0;
    const otherIncomeThisYear = initialOtherIncome > 0 ? initialOtherIncome * Math.pow(1 + inflationDecimal, yearOffset) : 0;
    const fixedTaxableIncome = dbPensionThisYear + fasThisYear + statePensionThisYear + otherIncomeThisYear;
    
    // --- Calculate required withdrawals to meet target income ---
    let sippDrawdown = 0;
    let dcDrawdown = 0;
    let cashWithdrawal = 0;
    let isaWithdrawal = 0;
    let giaWithdrawal = 0;

    if (isInRetirement && targetAnnualNetIncome > 0) {
        const taxOnFixedIncome = Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
        const netFromFixedIncome = fixedTaxableIncome - taxOnFixedIncome;
        let netShortfall = Math.max(0, inflatedTargetNetIncome - netFromFixedIncome);
    
        if (netShortfall > 0 && cashPotThisYear > 0) {
            const draw = Math.min(cashPotThisYear, netShortfall);
            cashWithdrawal = draw;
            cashPotThisYear -= draw;
            netShortfall -= draw;
        }

        if (netShortfall > 0 && giaPotThisYear > 0) {
          const draw = Math.min(giaPotThisYear, netShortfall);
          giaWithdrawal = draw;
          giaPotThisYear -= draw;
          netShortfall -= draw;
        }

        if (netShortfall > 0 && isaPotThisYear > 0) {
          const draw = Math.min(isaPotThisYear, netShortfall);
          isaWithdrawal = draw;
          isaPotThisYear -= draw;
          netShortfall -= draw;
        }

        if (netShortfall > 0 && dcPot > 0) {
            const grossDrawdownRequired = netShortfall / (1 - ( (1 - UFPLS_TAX_FREE_PORTION) * INCOME_TAX_RATE));
            const draw = Math.min(dcPot, grossDrawdownRequired);
            dcDrawdown = draw;
            const taxablePart = draw * (1 - UFPLS_TAX_FREE_PORTION);
            const taxOnDraw = Math.max(0, (fixedTaxableIncome + taxablePart) - currentPersonalAllowance) * INCOME_TAX_RATE - taxOnFixedIncome;
            const netFromDraw = draw - taxOnDraw;
            netShortfall -= netFromDraw;
        }

        if (netShortfall > 0 && sippPot > 0) {
            const taxablePortionRate = takeSippLumpSum ? 1.0 : (1 - UFPLS_TAX_FREE_PORTION);
            const grossDrawdownRequired = netShortfall / (1 - (taxablePortionRate * INCOME_TAX_RATE));
            sippDrawdown = Math.min(sippPot, grossDrawdownRequired);
        }
    }
    
    // --- Standard SIPP withdrawal rate if surplus or no target ---
    if (isInRetirement && showSipp && sippWithdrawalRate > 0) {
      const netFromFixedIncome = fixedTaxableIncome - Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE;
      const isSurplusYear = (targetAnnualNetIncome > 0 && (netFromFixedIncome >= inflatedTargetNetIncome));
      const noTargetIncome = targetAnnualNetIncome <= 0;
      
      const availableSippForStandardWithdrawal = sippPot - sippDrawdown;

      if (availableSippForStandardWithdrawal > 0 && (noTargetIncome || (isSurplusYear && applySippWithdrawalRateInSurplus))) {
        const standardWithdrawal = availableSippForStandardWithdrawal * (sippWithdrawalRate / 100);
        sippDrawdown += standardWithdrawal;
      }
    }
    sippDrawdown = Math.min(sippPot, sippDrawdown);
    dcDrawdown = Math.min(dcPot, dcDrawdown);
    
    // --- Apply pension deductions and growth ---
    if(showSipp) {
        let sippPotAfterDrawdown = sippPot - sippDrawdown;
        const sippAmcCharge = sippPotAfterDrawdown * sippAmcDecimal;
        row['SIPP AMC Charge'] = sippAmcCharge;
        const sippPotAfterDeductions = sippPotAfterDrawdown - sippAmcCharge;
        row['SIPP After Deductions'] = sippPotAfterDeductions;
        const sippGrowth = sippPotAfterDeductions * sippGrowthDecimal;
        row['SIPP Growth'] = sippGrowth;
        sippPot = sippPotAfterDeductions + sippGrowth;
        row['SIPP Balance'] = sippPot;
    }

    if(showDc) {
        let dcPotAfterDrawdown = dcPot - dcDrawdown;
        const dcAmcCharge = dcPotAfterDrawdown * dcAmcDecimal;
        row['DC AMC Charge'] = dcAmcCharge;
        const dcPotAfterDeductions = dcPotAfterDrawdown - dcAmcCharge;
        row['DC After Deductions'] = dcPotAfterDeductions;
        const dcGrowth = dcPotAfterDeductions * dcGrowthDecimal;
        row['DC Growth'] = dcGrowth;
        dcPot = dcPotAfterDeductions + dcGrowth;
        row['DC Balance'] = dcPot;
    }

    // --- Finalize balances for next year ---
    cashPot = cashPotThisYear;
    isaPot = isaPotThisYear;
    giaPot = giaPotThisYear;
    
    if(showCash) {
      row['Withdraw from Cash'] = cashWithdrawal;
      row['Cash Savings Balance'] = cashPot;
    }
    if(showIsa) {
      row['Withdraw from ISA'] = isaWithdrawal;
      row['ISA Balance'] = isaPot;
    }
    if(showGia) {
      row['Withdraw from GIA'] = giaWithdrawal;
      row['GIA Balance'] = giaPot;
    }

    const taxableSippIncome = takeSippLumpSum ? sippDrawdown : (sippDrawdown * (1 - UFPLS_TAX_FREE_PORTION));
    const taxableDcIncome = dcDrawdown * (1-UFPLS_TAX_FREE_PORTION);
    const totalTaxableIncome = fixedTaxableIncome + taxableSippIncome + taxableDcIncome;
    const incomeSubjectToTaxForTable = Math.max(0, totalTaxableIncome - currentPersonalAllowance);
    const taxPaid = incomeSubjectToTaxForTable * INCOME_TAX_RATE;
    
    const nonTaxableSippIncome = takeSippLumpSum ? 0 : (sippDrawdown * UFPLS_TAX_FREE_PORTION);
    const nonTaxableDcIncome = dcDrawdown * UFPLS_TAX_FREE_PORTION;
    const totalGrossIncome = fixedTaxableIncome + sippDrawdown + dcDrawdown;
    const totalSavingsWithdrawal = cashWithdrawal + isaWithdrawal + giaWithdrawal;
    const totalNetIncome = (totalTaxableIncome - taxPaid) + nonTaxableSippIncome + nonTaxableDcIncome + totalSavingsWithdrawal + sippLumpSumThisYear;

    Object.assign(row, {
        'SIPP Drawdown': sippDrawdown,
        'DC Drawdown': dcDrawdown,
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

    