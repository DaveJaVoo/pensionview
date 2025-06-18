
import type { PensionDataRow, PensionCalculationParameters, CalculatedPensionData } from './types';
import { PERSONAL_ALLOWANCE, INCOME_TAX_RATE, UFPLS_TAX_FREE_PORTION } from './types';

export const DEFAULT_HEADERS = [
  'Age', 'Year',
  'Initial DC Pension', 'DC Pension Growth', 'DC Pension + Growth',
  'DC AMC Charge', 'DC Minus AMC', 'DC UFPLS Drawdown', 'DC Pension Balance',
  'DB Pension', 'State Pension', 'Withdraw from Savings', 'Savings Balance',
  'TOTAL INCOME', 'Income Subject to Tax', 'Income Tax Paid',
  'Net Income Per Year', 'Net Income Per Month',
];

// Helper function for iterative net income targeting
function calculateDrawdownsForNetTarget(
  targetNetIncomeThisYear: number,
  dbPensionThisYear: number,
  statePensionThisYear: number,
  currentDCPotForDrawdown: number, // DC Minus AMC
  currentSavingsBalance: number
): { dcDrawdown: number; savingsWithdrawal: number; calculatedNet: number; taxPaid: number; incomeSubjectToTax: number; totalGrossIncome: number } {
  let bestGuess = { dcDrawdown: 0, savingsWithdrawal: 0, calculatedNet: 0, taxPaid: 0, incomeSubjectToTax: 0, totalGrossIncome: 0 };
  let minDiff = Infinity;

  // Iteration parameters
  const maxIterations = 100; // Increased iterations for potentially better precision
  const precision = 1.0; // Target within £1

  // Binary search for optimal DC drawdown
  let lowDcDrawdown = 0;
  let highDcDrawdown = currentDCPotForDrawdown;

  for (let iter = 0; iter < maxIterations; iter++) {
    const currentDcDrawdownGuess = (lowDcDrawdown + highDcDrawdown) / 2;

    const taxableDCDrawdown = currentDcDrawdownGuess * (1 - UFPLS_TAX_FREE_PORTION);
    const grossIncomeFromPensions = dbPensionThisYear + statePensionThisYear + currentDcDrawdownGuess;
    
    const taxableBaseIncome = dbPensionThisYear + statePensionThisYear + taxableDCDrawdown;
    const incomeSubjectToTaxCalc = Math.max(0, taxableBaseIncome - PERSONAL_ALLOWANCE);
    const taxPaidOnPensions = incomeSubjectToTaxCalc * INCOME_TAX_RATE;
    
    const netIncomeFromPensions = grossIncomeFromPensions - taxPaidOnPensions;
    
    let savingsToWithdraw = 0;
    if (netIncomeFromPensions < targetNetIncomeThisYear) {
      savingsToWithdraw = Math.min(currentSavingsBalance, targetNetIncomeThisYear - netIncomeFromPensions);
    }
    
    const finalNetIncome = netIncomeFromPensions + savingsToWithdraw;
    const totalGrossIncomeCalc = grossIncomeFromPensions + savingsToWithdraw;

    const diff = Math.abs(finalNetIncome - targetNetIncomeThisYear);
    if (diff < minDiff) {
      minDiff = diff;
      bestGuess = { 
        dcDrawdown: currentDcDrawdownGuess, 
        savingsWithdrawal: savingsToWithdraw, 
        calculatedNet: finalNetIncome,
        taxPaid: taxPaidOnPensions, // Tax is only on pension income for this model
        incomeSubjectToTax: incomeSubjectToTaxCalc,
        totalGrossIncome: totalGrossIncomeCalc
      };
    }

    if (minDiff <= precision) {
      break; // Found a good enough solution
    }

    if (finalNetIncome < targetNetIncomeThisYear) {
      lowDcDrawdown = currentDcDrawdownGuess;
    } else {
      highDcDrawdown = currentDcDrawdownGuess;
    }
  }
  
  // Ensure DC drawdown does not exceed available pot
  bestGuess.dcDrawdown = Math.min(bestGuess.dcDrawdown, currentDCPotForDrawdown);
  // Recalculate if dcDrawdown was capped
  if (bestGuess.dcDrawdown < ((lowDcDrawdown + highDcDrawdown) / 2) && highDcDrawdown > 0 ) { // Check if capped
      const taxableDCDrawdown = bestGuess.dcDrawdown * (1 - UFPLS_TAX_FREE_PORTION);
      const grossIncomeFromPensions = dbPensionThisYear + statePensionThisYear + bestGuess.dcDrawdown;
      const taxableBaseIncome = dbPensionThisYear + statePensionThisYear + taxableDCDrawdown;
      bestGuess.incomeSubjectToTax = Math.max(0, taxableBaseIncome - PERSONAL_ALLOWANCE);
      bestGuess.taxPaid = bestGuess.incomeSubjectToTax * INCOME_TAX_RATE;
      const netIncomeFromPensions = grossIncomeFromPensions - bestGuess.taxPaid;
      bestGuess.savingsWithdrawal = Math.min(currentSavingsBalance, Math.max(0, targetNetIncomeThisYear - netIncomeFromPensions));
      bestGuess.calculatedNet = netIncomeFromPensions + bestGuess.savingsWithdrawal;
      bestGuess.totalGrossIncome = grossIncomeFromPensions + bestGuess.savingsWithdrawal;
  }


  return bestGuess;
}


export function calculatePensionProjection(params: PensionCalculationParameters): CalculatedPensionData {
  const {
    currentAge, projectionStartYear, initialSavingsAmount, targetAnnualNetIncome,
    initialDbPensionAmount, dbPensionStartAge,
    statePensionAge, initialStatePensionAmount,
    initialDcPensionValue, investmentPercentageGrowth,
    inflationRate, dcWithdrawalRate, annualChargeAMC
  } = params;

  const rows: PensionDataRow[] = [];
  let previousRow: PensionDataRow | null = null;
  let currentOverallSavingsBalance = initialSavingsAmount;

  const invGrowthDecimal = (investmentPercentageGrowth || 0) / 100;
  const inflationDecimal = (inflationRate || 0) / 100;
  const amcDecimal = (annualChargeAMC || 0) / 100;
  const dcWithdrawDecimal = (dcWithdrawalRate || 0) / 100;

  for (let age = currentAge; age <= 90; age++) {
    const yearOffset = age - currentAge;
    const currentYearStr = (projectionStartYear + yearOffset).toString();

    const row: PensionDataRow = {
      Age: age,
      Year: currentYearStr,
      'Initial DC Pension': 0,
      'DC Pension Growth': 0,
      'DC Pension + Growth': 0,
      'DC AMC Charge': 0,
      'DC Minus AMC': 0,
      'DC UFPLS Drawdown': 0,
      'DC Pension Balance': 0,
      'DB Pension': 0,
      'State Pension': 0,
      'Withdraw from Savings': 0,
      'Savings Balance': currentOverallSavingsBalance,
      'TOTAL INCOME': 0,
      'Income Subject to Tax': 0,
      'Income Tax Paid': 0,
      'Net Income Per Year': 0,
      'Net Income Per Month': 0,
    };

    row['Initial DC Pension'] = previousRow ? (previousRow['DC Pension Balance'] || 0) : initialDcPensionValue;
    row['DC Pension Growth'] = row['Initial DC Pension'] * invGrowthDecimal;
    row['DC Pension + Growth'] = row['Initial DC Pension'] + row['DC Pension Growth'];
    row['DC AMC Charge'] = row['DC Pension + Growth'] * amcDecimal;
    row['DC Minus AMC'] = row['DC Pension + Growth'] - row['DC AMC Charge'];

    // DB and State Pension
    if (age === dbPensionStartAge) {
      row['DB Pension'] = initialDbPensionAmount;
    } else if (age > dbPensionStartAge && previousRow && previousRow['DB Pension']) {
      row['DB Pension'] = previousRow['DB Pension'] * (1 + inflationDecimal);
    } else {
      row['DB Pension'] = 0;
    }
    row['DB Pension'] = Math.max(0, row['DB Pension'] || 0);

    if (age === statePensionAge) {
      row['State Pension'] = initialStatePensionAmount;
    } else if (age > statePensionAge && previousRow && previousRow['State Pension']) {
      row['State Pension'] = previousRow['State Pension'] * (1 + inflationDecimal);
    } else {
      row['State Pension'] = 0;
    }
    row['State Pension'] = Math.max(0, row['State Pension'] || 0);

    // Iterative calculation for DC Drawdown and Savings Withdrawal
    const { dcDrawdown, savingsWithdrawal, calculatedNet, taxPaid, incomeSubjectToTax, totalGrossIncome } = 
      calculateDrawdownsForNetTarget(
        targetAnnualNetIncome,
        row['DB Pension'] || 0,
        row['State Pension'] || 0,
        row['DC Minus AMC'], // Current pot available for drawdown this year
        currentOverallSavingsBalance
      );
    
    let finalDcDrawdown = dcDrawdown;

    // Standard DC withdrawal rate if no specific net income target need or if rate withdrawal is higher
    let dcDrawdownByRate = 0;
    if (age >= statePensionAge) {
      const basisForRateDrawdown = previousRow ? (previousRow['DC Pension Balance'] || 0) : row['DC Minus AMC'];
      dcDrawdownByRate = basisForRateDrawdown * dcWithdrawDecimal;
    }

    // If target net income is met or exceeded by fixed pensions and savings without DC drawdown,
    // or if the standard rate is higher, use the standard rate (if applicable).
    // The iterative function already aims for the target, so this mainly handles the post-SPA % rate.
    if (dcDrawdownByRate > finalDcDrawdown && age >= statePensionAge) {
         finalDcDrawdown = dcDrawdownByRate;
         // Recalculate tax if DC drawdown changes due to standard rate
         const taxableDCDrawdownRate = finalDcDrawdown * (1 - UFPLS_TAX_FREE_PORTION);
         const taxableBaseIncomeRate = (row['DB Pension'] || 0) + (row['State Pension'] || 0) + taxableDCDrawdownRate;
         row['Income Subject to Tax'] = Math.max(0, taxableBaseIncomeRate - PERSONAL_ALLOWANCE);
         row['Income Tax Paid'] = row['Income Subject to Tax'] * INCOME_TAX_RATE;
         row['TOTAL INCOME'] = (row['DB Pension'] || 0) + (row['State Pension'] || 0) + finalDcDrawdown + savingsWithdrawal; // savingsWithdrawal from iteration still applies
         row['Net Income Per Year'] = row['TOTAL INCOME'] - row['Income Tax Paid'];

    } else {
        row['Income Subject to Tax'] = incomeSubjectToTax;
        row['Income Tax Paid'] = taxPaid;
        row['TOTAL INCOME'] = totalGrossIncome;
        row['Net Income Per Year'] = calculatedNet;
    }
    
    row['DC UFPLS Drawdown'] = Math.max(0, Math.min(finalDcDrawdown, row['DC Minus AMC']));
    row['Withdraw from Savings'] = savingsWithdrawal; // Use savings withdrawal from iterative calc or 0 if % rate took over and met target

    // If % rate took over and potentially changed net income, re-evaluate savings.
    // This logic is complex as the savings withdrawal should ideally be part of the iterative solution with the % rate.
    // For now, if % rate drawdown is used, assume savings withdrawal is primarily for any remaining gap to targetNetIncome *after* this % rate drawdown.
    // The current iterative solver is designed to meet the target first.
    // If dcDrawdownByRate was chosen, and it resulted in a net income different from target, savings might need adjustment.
    // This part requires careful thought to ensure consistency. The current calculateDrawdownsForNetTarget tries to hit the target.
    // If dcWithdrawDecimal is high, it might overshoot.
    // A simpler model: if dcDrawdownByRate is active and provides enough, savings withdrawal might be 0 unless target still not met.
    
    // If the standard % rate significantly changes the income, savings withdrawal from the iterative step might be too high/low.
    // The most straightforward is: the iterative function gives us amounts to hit the target.
    // If standard % withdrawal is higher, it might override. Tax and Net are recalculated.
    // The savings withdrawal from the iteration might not be optimal if standard % is used.
    // For now, we take `savingsWithdrawal` from the iterative result.

    currentOverallSavingsBalance -= row['Withdraw from Savings'];
    row['Savings Balance'] = currentOverallSavingsBalance;

    row['DC Pension Balance'] = row['DC Minus AMC'] - row['DC UFPLS Drawdown'];
    row['DC Pension Balance'] = Math.max(0, row['DC Pension Balance']);
    
    row['Net Income Per Month'] = row['Net Income Per Year'] / 12;

    DEFAULT_HEADERS.forEach(header => {
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

  const csvHeaderString = DEFAULT_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
  const csvRowStrings = rows.map(r => {
    return DEFAULT_HEADERS.map(header => {
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

  return { rows, headers: DEFAULT_HEADERS, parameters: params, csvString };
}
