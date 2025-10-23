
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';


/**
 * Solves for the gross pension withdrawal (G) required to achieve a specific net income (N).
 * This function correctly models both UFPLS (tax-free element per withdrawal) and PCLS-taken (fully taxable withdrawal) scenarios.
 * @param netNeeded The target net income required from this withdrawal.
 * @param remainingPersonalAllowance The personal allowance left after accounting for other income.
 * @param pclsTaken A flag indicating if the 25% tax-free lump sum was already taken for this pot.
 * @returns The gross withdrawal amount required to achieve the net income.
 */
function getGrossPensionWithdrawalForNet(netNeeded: number, remainingPersonalAllowance: number, pclsTaken: boolean): number {
    if (netNeeded <= 0) {
        return 0;
    }

    // SCENARIO 1: PCLS was taken upfront. The entire withdrawal is taxable.
    if (pclsTaken) {
        // Amount of net income that can be fulfilled by the allowance without being taxed.
        const coveredByAllowance = Math.min(netNeeded, remainingPersonalAllowance);
        
        // Remaining net income that must be fulfilled by a taxed portion of the withdrawal.
        const netNeededFromTaxablePortion = netNeeded - coveredByAllowance;

        if (netNeededFromTaxablePortion <= 0) {
            // The entire net needed is covered by the personal allowance.
            return coveredByAllowance;
        }

        // To get a certain net amount from a taxed source, we need to "gross it up".
        // Gross = Net / (1 - TaxRate)
        const grossForTaxedPortion = netNeededFromTaxablePortion / (1 - INCOME_TAX_RATE);
        
        return coveredByAllowance + grossForTaxedPortion;
    }

    // SCENARIO 2: UFPLS. Each withdrawal is 25% tax-free and 75% taxable.
    // Let G be the Gross withdrawal.
    // Net = (G * 0.25) + NetFromTaxablePortion where NetFromTaxablePortion is the net from (G * 0.75)
    
    // The taxable part of the withdrawal (75% of Gross) first uses up the personal allowance.
    const taxablePartCoveredByAllowance = remainingPersonalAllowance;
    const grossWithdrawalToUseUpAllowance = taxablePartCoveredByAllowance / (1 - UFPLS_TAX_FREE_PORTION); // e.g., allowance / 0.75
    
    // The net income we get from this first part of the withdrawal is equal to the gross, as no tax is paid.
    const netFromAllowancePortion = grossWithdrawalToUseUpAllowance;

    if (netNeeded <= netFromAllowancePortion) {
        // If the required net is less than what we can get just by using the allowance,
        // we don't need to withdraw the full `grossWithdrawalToUseUpAllowance`.
        // In this tax-free region, Net = Gross.
        return netNeeded;
    }

    // If we are here, it means we need more net income than the allowance-covered portion can provide.
    const remainingNetNeeded = netNeeded - netFromAllowancePortion;
    
    // This remaining net must come from a withdrawal where the taxable part (75%) is fully taxed at 20%.
    // For this portion of the withdrawal (let's call it G_add):
    // Net_add = G_add * (0.25 + 0.75 * 0.8)
    // Net_add = G_add * (0.25 + 0.6)
    // Net_add = G_add * 0.85
    // G_add = Net_add / 0.85
    const additionalGrossNeeded = remainingNetNeeded / (1 - (1 - UFPLS_TAX_FREE_PORTION) * INCOME_TAX_RATE);

    return grossWithdrawalToUseUpAllowance + additionalGrossNeeded;
}


// --- Main Calculation Engine ---
export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const headers = generateHeaders(params);
  const rows: PensionDataRow[] = [];
  

  // --- 2. Initialize Pots for Main Loop ---
  let dcPot = params.initialDcPensionValue;
  let sippPot = params.initialSippValue;
  let cashPot = params.initialCashSavings;
  let isaPot = params.initialIsaAmount;
  let giaPot = params.initialGiaAmount;
  
  let pclsTakenFromDc = false;
  let pclsTakenFromSipp = false;
  let dcTaxFreeLumpSumTaken = 0;
  let sippTaxFreeLumSumTaken = 0;

  // --- 3. Main Projection Loop ---
  for (let age = params.currentAge; age <= params.projectionEndAge; age++) {
    const currentYear = params.calculationTriggerYear + (age - params.currentAge);
    const isRetired = age >= params.retirementAge;
    const yearsSinceCurrentAge = age - params.currentAge;
    const inflationMultiplierFromStart = Math.pow(1 + params.inflationRate / 100, yearsSinceCurrentAge);
    const currentPersonalAllowance = PERSONAL_ALLOWANCE * inflationMultiplierFromStart;

    const initialBalances = { dc: dcPot, sipp: sippPot, cash: cashPot, isa: isaPot, gia: giaPot };
    let contributions = { dc: 0, sipp: 0, cash: 0, isa: 0, gia: 0 };
    let withdrawals = { dc: 0, sipp: 0, cash: 0, isa: 0, gia: 0 };
    
    // --- Step A: Contributions ---
    if (age < params.dcContributionEndAge) contributions.dc = params.annualDcPensionContribution;
    if (age < params.sippContributionEndAge) contributions.sipp = params.annualSippContribution;
    if (age < params.cashContributionEndAge) contributions.cash = params.annualCashContribution;
    if (age < params.isaContributionEndAge) contributions.isa = params.annualIsaContribution;
    if (age < params.giaContributionEndAge) contributions.gia = params.annualGiaContribution;
    
    dcPot += contributions.dc;
    sippPot += contributions.sipp;
    cashPot += contributions.cash;
    isaPot += contributions.isa;
    giaPot += contributions.gia;

    // --- Step B: PCLS at Retirement ---
    if (age === params.retirementAge) {
      if (params.takeTaxFreeLumpSum && dcPot > 0) {
        const lumpSum = dcPot * UFPLS_TAX_FREE_PORTION;
        dcTaxFreeLumpSumTaken = lumpSum;
        dcPot -= lumpSum;
        cashPot += lumpSum; // Lump sum goes into cash
        pclsTakenFromDc = true;
      }
      if (params.takeSippTaxFreeLumpSum && sippPot > 0) {
        const lumpSum = sippPot * UFPLS_TAX_FREE_PORTION;
        sippTaxFreeLumSumTaken = lumpSum;
        sippPot -= lumpSum;
        cashPot += lumpSum; // Lump sum goes into cash
        pclsTakenFromSipp = true;
      }
    }
    
    // --- Step C: Income & Withdrawals (Retirement) ---
    let totalGrossIncomeThisYear = 0;
    let taxablePensionIncomeFromDrawdown = 0;
    
    const dbPensionIncome = (params.initialDbPensionAmount > 0 && age >= params.dbPensionStartAge) ? params.initialDbPensionAmount * Math.pow(1 + params.inflationRate / 100, Math.max(0, age - params.dbPensionStartAge)) : 0;
    const statePensionIncome = (params.initialStatePensionAmount > 0 && age >= params.statePensionAge) ? params.initialStatePensionAmount * Math.pow(1 + params.inflationRate / 100, Math.max(0, age - params.statePensionAge)) : 0;
    const otherIncomeSource = params.initialOtherIncome > 0 ? params.initialOtherIncome * inflationMultiplierFromStart : 0;
    
    const fixedTaxableIncome = dbPensionIncome + statePensionIncome + otherIncomeSource;
    totalGrossIncomeThisYear += fixedTaxableIncome;

    // Apply ISA and GIA growth BEFORE withdrawals in retirement
    let isaGrowth = 0;
    let giaGrowth = 0;
    if (isRetired) {
      isaGrowth = isaPot * (params.isaGrowthRate / 100);
      giaGrowth = giaPot * (params.giaGrowthRate / 100);
      isaPot += isaGrowth;
      giaPot += giaGrowth;
    }
    
    if (isRetired) {
        const incomeTarget = params.targetAnnualNetIncome * inflationMultiplierFromStart;
        const netFromFixed = Math.max(0, fixedTaxableIncome - (Math.max(0, fixedTaxableIncome - currentPersonalAllowance) * INCOME_TAX_RATE));
        let netIncomeShortfall = Math.max(0, incomeTarget - netFromFixed);

        // CORRECTED Tax-Efficient Withdrawal Order: Cash -> GIA -> ISA -> Pensions
        // Use cash first (includes any PCLS) -> then GIAs -> then ISAs.
        const savingsWithdrawalOrder: ('cash' | 'gia' | 'isa')[] = ['cash', 'gia', 'isa'];

        // 1. Withdraw from non-pension assets first
        for (const potName of savingsWithdrawalOrder) {
            if (netIncomeShortfall <= 0) break;

            let potBalance = 0;
            switch(potName) {
                case 'gia': potBalance = giaPot; break;
                case 'cash': potBalance = cashPot; break;
                case 'isa': potBalance = isaPot; break;
            }
            if (potBalance <= 0) continue;
            
            const draw = Math.min(netIncomeShortfall, potBalance);
            switch(potName) {
                case 'gia': withdrawals.gia += draw; giaPot -= draw; break;
                case 'cash': withdrawals.cash += draw; cashPot -= draw; break;
                case 'isa': withdrawals.isa += draw; isaPot -= draw; break;
            }
            netIncomeShortfall -= draw;
        }
        
        // 2. If shortfall persists, withdraw from pensions tax-efficiently
        if (netIncomeShortfall > 0) {
            const pensionWithdrawalOrder = params.pensionDrawdownOrder === 'sipp_first' ? ['sipp', 'dc'] : ['dc', 'sipp'];
            
            for (const potName of pensionWithdrawalOrder) {
                if (netIncomeShortfall <= 0) break;
                
                let potBalance = potName === 'dc' ? dcPot : sippPot;
                if (potBalance <= 0) continue;

                const pclsTaken = potName === 'dc' ? pclsTakenFromDc : pclsTakenFromSipp;
                const remainingAllowance = Math.max(0, currentPersonalAllowance - fixedTaxableIncome - taxablePensionIncomeFromDrawdown);
                
                const grossWithdrawalNeeded = getGrossPensionWithdrawalForNet(netIncomeShortfall, remainingAllowance, pclsTaken);
                const actualGrossWithdrawal = Math.min(potBalance, grossWithdrawalNeeded);
                
                const taxablePartOfWithdrawal = actualGrossWithdrawal * (pclsTaken ? 1 : (1 - UFPLS_TAX_FREE_PORTION));
                const taxOnThisWithdrawal = Math.max(0, taxablePartOfWithdrawal - remainingAllowance) * INCOME_TAX_RATE;
                const netFromThisWithdrawal = actualGrossWithdrawal - taxOnThisWithdrawal;

                if (potName === 'dc') {
                    withdrawals.dc += actualGrossWithdrawal;
                    dcPot -= actualGrossWithdrawal;
                } else { // SIPP
                    withdrawals.sipp += actualGrossWithdrawal;
                    sippPot -= actualGrossWithdrawal;
                }
                
                taxablePensionIncomeFromDrawdown += taxablePartOfWithdrawal;
                netIncomeShortfall -= netFromThisWithdrawal;
                totalGrossIncomeThisYear += actualGrossWithdrawal;
            }
        }

        // 3. Handle Surplus Withdrawals post-SPA if income target was met
        if (age >= params.statePensionAge && netIncomeShortfall <= 0) {
            const withdrawSurplus = (potName: 'dc' | 'sipp') => {
                 let potBalance = potName === 'dc' ? dcPot : sippPot;
                 if (potBalance <= 0) return;

                 const withdrawalRate = potName === 'dc' ? params.dcWithdrawalRate : params.sippWithdrawalRate;
                 const applyInSurplus = potName === 'dc' ? params.applyDcWithdrawalRateInSurplus : params.applySippWithdrawalRateInSurplus;
                 
                 const potForRateCalc = (potName === 'dc' ? initialBalances.dc + contributions.dc : initialBalances.sipp + contributions.sipp);

                 if (applyInSurplus && withdrawalRate > 0 && potForRateCalc > 0) {
                     const targetTotalWithdrawal = potForRateCalc * (withdrawalRate / 100);
                     const alreadyWithdrawn = potName === 'dc' ? withdrawals.dc : withdrawals.sipp;
                     
                     const additionalGrossWithdrawalNeeded = Math.max(0, targetTotalWithdrawal - alreadyWithdrawn);
                     const actualAdditionalWithdrawal = Math.min(potBalance, additionalGrossWithdrawalNeeded);
                     
                     if (actualAdditionalWithdrawal > 0) {
                         const pclsTaken = potName === 'dc' ? pclsTakenFromDc : pclsTakenFromSipp;
                         const taxablePartOfAdditional = actualAdditionalWithdrawal * (pclsTaken ? 1 : (1 - UFPLS_TAX_FREE_PORTION));
                         
                         if (potName === 'dc') {
                           withdrawals.dc += actualAdditionalWithdrawal;
                           dcPot -= actualAdditionalWithdrawal;
                         } else {
                           withdrawals.sipp += actualAdditionalWithdrawal;
                           sippPot -= actualAdditionalWithdrawal;
                         }
                         taxablePensionIncomeFromDrawdown += taxablePartOfAdditional;
                         totalGrossIncomeThisYear += actualAdditionalWithdrawal;
                     }
                 }
            };
            withdrawSurplus('dc');
            withdrawSurplus('sipp');
        }
    }
    
    // --- Step D: Apply Charges & Growth ---
    const dcAmcCharge = dcPot * (params.annualChargeAMC / 100);
    const dcAfterCharges = dcPot - dcAmcCharge;
    const dcGrowth = dcAfterCharges * (params.investmentPercentageGrowth / 100);
    const finalDcPot = Math.max(0, dcAfterCharges + dcGrowth);

    const sippAmcCharge = sippPot * (params.sippAnnualChargeAMC / 100);
    const sippAfterCharges = sippPot - sippAmcCharge;
    const sippGrowth = sippAfterCharges * (params.sippInvestmentPercentageGrowth / 100);
    const finalSippPot = Math.max(0, sippAfterCharges + sippGrowth);

    // Note: ISA/GIA growth for pre-retirement or if not touched in retirement
    if (!isRetired) {
        isaGrowth = isaPot * (params.isaGrowthRate / 100);
        giaGrowth = giaPot * (params.giaGrowthRate / 100);
        isaPot += isaGrowth;
        giaPot += giaGrowth;
    }
    const finalIsaPot = Math.max(0, isaPot);
    const finalGiaPot = Math.max(0, giaPot);
    const finalCashPot = Math.max(0, cashPot);

    // --- Step E: Final Tax & Net Income ---
    const totalTaxableIncomeThisYear = fixedTaxableIncome + taxablePensionIncomeFromDrawdown;
    const incomeTaxPaid = Math.max(0, totalTaxableIncomeThisYear - currentPersonalAllowance) * INCOME_TAX_RATE;
    
    const netFromTaxableSources = totalTaxableIncomeThisYear - incomeTaxPaid;
    const nonTaxablePensionPortion = (withdrawals.dc * (pclsTakenFromDc ? 0 : UFPLS_TAX_FREE_PORTION)) + (withdrawals.sipp * (pclsTakenFromSipp ? 0 : UFPLS_TAX_FREE_PORTION));
    
    const finalNetIncome = netFromTaxableSources + nonTaxablePensionPortion + withdrawals.cash + withdrawals.isa + withdrawals.gia;

    // --- Step F: Assemble Row & Update Pots for Next Loop ---
    const row: PensionDataRow = {
      'Age': age, 'Year': String(currentYear),
      'Initial DC Pension': initialBalances.dc, 'DC Pension Contribution': contributions.dc, 'DC Pension Drawdown': withdrawals.dc,
      'DC AMC Charge': dcAmcCharge, 'DC Pension After Deductions': dcAfterCharges, 'DC Pension Growth': dcGrowth, 'DC Pension Balance': finalDcPot,
      'Initial SIPP': initialBalances.sipp, 'SIPP Contribution': contributions.sipp, 'SIPP Drawdown': withdrawals.sipp,
      'SIPP AMC Charge': sippAmcCharge, 'SIPP After Deductions': sippAfterCharges, 'SIPP Growth': sippGrowth, 'SIPP Balance': finalSippPot,
      'DB Pension': dbPensionIncome, 'State Pension': statePensionIncome, 'Other Income': otherIncomeSource,
      'Cash Savings Initial': initialBalances.cash, 'Cash Savings Contribution': contributions.cash, 'Withdraw from Cash': withdrawals.cash, 'Cash Savings Balance': finalCashPot,
      'ISA Initial': initialBalances.isa, 'ISA Contribution': contributions.isa, 'ISA Growth': isaGrowth, 'ISA Value Before Withdrawal': initialBalances.isa + contributions.isa + isaGrowth, 'Withdraw from ISA': withdrawals.isa, 'ISA Balance': finalIsaPot,
      'GIA Initial': initialBalances.gia, 'GIA Contribution': contributions.gia, 'GIA Growth': giaGrowth, 'GIA Value Before Withdrawal': initialBalances.gia + contributions.gia + giaGrowth, 'Withdraw from GIA': withdrawals.gia, 'GIA Balance': finalGiaPot,
      'Total Savings Withdrawn': withdrawals.cash + withdrawals.isa + withdrawals.gia,
      'Total Savings Balance': finalCashPot + finalIsaPot + finalGiaPot,
      'TOTAL INCOME': totalGrossIncomeThisYear, 'Income Subject to Tax': totalTaxableIncomeThisYear, 'Income Tax Paid': incomeTaxPaid, 'Net Income Per Year': finalNetIncome, 'Net Income Per Month': finalNetIncome / 12,
    };
    rows.push(row);
    
    dcPot = finalDcPot;
    sippPot = finalSippPot;
    cashPot = finalCashPot;
    isaPot = finalIsaPot;
    giaPot = finalGiaPot;
  }
  
  const outputParameters = { 
    ...params, 
    retirementAge: params.retirementAge,
    taxFreeLumpSumTaken: dcTaxFreeLumpSumTaken,
    sippTaxFreeLumpSumTaken: sippTaxFreeLumSumTaken,
  };

  return { rows, headers, parameters: outputParameters, csvString: generateCsvString(headers, rows) };
}

function generateHeaders(params: PensionCalculationParameters): string[] {
    const headers: string[] = ['Age', 'Year'];
    
    const hasDC = params.initialDcPensionValue > 0 || params.annualDcPensionContribution > 0 || params.dcWithdrawalRate > 0;
    const hasSIPP = params.initialSippValue > 0 || params.annualSippContribution > 0 || params.sippWithdrawalRate > 0;
    const hasDB = params.initialDbPensionAmount > 0;
    const hasSP = params.initialStatePensionAmount > 0;
    const hasOther = params.initialOtherIncome > 0;
    const hasCash = params.initialCashSavings > 0 || params.annualCashContribution > 0;
    const hasISA = params.initialIsaAmount > 0 || params.annualIsaContribution > 0;
    const hasGIA = params.initialGiaAmount > 0 || params.annualGiaContribution > 0;
    const hasSavings = hasCash || hasISA || hasGIA;

    if (hasDC) headers.push('Initial DC Pension', 'DC Pension Contribution', 'DC Pension Drawdown', 'DC AMC Charge', 'DC Pension After Deductions', 'DC Pension Growth', 'DC Pension Balance');
    if (hasSIPP) headers.push('Initial SIPP', 'SIPP Contribution', 'SIPP Drawdown', 'SIPP AMC Charge', 'SIPP After Deductions', 'SIPP Growth', 'SIPP Balance');
    if (hasDB) headers.push('DB Pension');
    if (hasSP) headers.push('State Pension');
    if (hasOther) headers.push('Other Income');

    if (hasCash) headers.push('Cash Savings Initial', 'Cash Savings Contribution', 'Withdraw from Cash', 'Cash Savings Balance');
    if (hasISA) headers.push('ISA Initial', 'ISA Contribution', 'ISA Growth', 'ISA Value Before Withdrawal', 'Withdraw from ISA', 'ISA Balance');
    if (hasGIA) headers.push('GIA Initial', 'GIA Contribution', 'GIA Growth', 'GIA Value Before Withdrawal', 'Withdraw from GIA', 'GIA Balance');
    
    if (hasSavings) headers.push('Total Savings Withdrawn', 'Total Savings Balance');
    
    headers.push('TOTAL INCOME', 'Income Subject to Tax', 'Income Tax Paid', 'Net Income Per Year', 'Net Income Per Month');
    
    return headers.filter((value, index, self) => self.indexOf(value) === index);
}

function generateCsvString(headers: string[], rows: PensionDataRow[]): string {
    const csvHeaderString = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    const csvRowStrings = rows.map(r => 
        headers.map(header => {
            const val = r[header];
            if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return "";
            const sVal = String(val);
            return sVal.includes(',') || sVal.includes('"') || sVal.includes('\n') ? `"${sVal.replace(/"/g, '""')}"` : sVal;
        }).join(',')
    );
    return [csvHeaderString, ...csvRowStrings].join('\n');
}
    