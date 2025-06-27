
'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting adjustments to UFPLS drawdown amounts
 *  from DC Pension and SIPP to help the user aim for a zero balance in these pots at the end of their pension plan.
 *
 * - drawdownOptimization - A function that suggests adjustments to drawdown amounts.
 * - DrawdownOptimizationInput - The input type for the drawdownOptimization function.
 * - DrawdownOptimizationOutput - The return type for the drawdownOptimization function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DrawdownOptimizationInputSchema = z.object({
  pensionDataCsv: z
    .string()
    .describe('A CSV string containing the user’s pension data, including all calculated columns such as Cash, ISA, and GIA savings details, DC Pension Contributions, and SIPP Contributions.'),
  initialDcPensionValue: z.number().describe('The initial value of the DC pension (before any PCLS taken and before any future contributions).'),
  annualDcPensionContribution: z.number().optional().describe('The gross annual DC pension contribution amount until contribution end age.'),
  dcContributionStartAge: z.number().optional().describe('The age at which annual DC pension contributions start.'),
  dcContributionEndAge: z.number().optional().describe('The age at which annual DC pension contributions end.'),
  takeTaxFreeLumpSum: z.boolean().optional().describe('Whether a 25% tax-free lump sum was taken upfront from the DC pension.'),
  taxFreeLumpSumTaken: z.number().optional().describe('The amount of DC pension tax-free lump sum taken, if applicable.'),
  investmentPercentageGrowth: z.number().describe('The DC pension investment percentage growth rate.'),
  dcWithdrawalRate: z.number().describe('The DC UFPLS withdrawal rate used in the projection (when not meeting a specific income shortfall, or if it results in higher income post-SPA).'), 
  annualChargeAMC: z.number().describe('The DC pension annual charge (AMC) as a decimal (e.g., 0.5 for 0.5%).'),
  
  initialSippValue: z.number().optional().describe('The initial value of the SIPP (before any PCLS taken and before any future contributions).'),
  annualSippContribution: z.number().optional().describe('The gross annual SIPP contribution amount until SIPP contribution end age.'),
  sippContributionStartAge: z.number().optional().describe('The age at which annual SIPP contributions start.'),
  sippContributionEndAge: z.number().optional().describe('The age at which annual SIPP contributions end.'),
  takeSippTaxFreeLumpSum: z.boolean().optional().describe('Whether a 25% tax-free lump sum was taken upfront from the SIPP.'),
  sippTaxFreeLumpSumTaken: z.number().optional().describe('The amount of SIPP tax-free lump sum taken, if applicable.'),
  sippInvestmentPercentageGrowth: z.number().optional().describe('The SIPP investment percentage growth rate.'),
  sippAnnualChargeAMC: z.number().optional().describe('The SIPP annual charge (AMC) as a decimal (e.g., 0.5 for 0.5%).'),
  sippWithdrawalRate: z.number().optional().describe('The SIPP UFPLS withdrawal rate used in the projection (when not meeting a specific income shortfall, or if it results in higher income post-SPA).'),

  isaGrowthRate: z.number().optional().describe('The ISA investment percentage growth rate.'),
  giaGrowthRate: z.number().optional().describe('The GIA investment percentage growth rate.'),
  inflationRate: z.number().describe('The inflation rate.'),
  statePensionAge: z.number().describe('The age at which state pension begins, influencing drawdown needs.'),
  currentAge: z.number().optional().describe('User current age from the projection.'),
  projectionEndAge: z.number().optional().describe('The end age of the projection (e.g. 90).'),
  targetAnnualNetIncome: z.number().optional().describe('The user\'s target annual income AFTER TAX.'),
  initialOtherIncome: z.number().optional().describe("The user's other regular annual income, which is assumed to grow with inflation."),
  initialFasAmount: z.number().optional().describe("The user's annual income from the Financial Assistance Scheme (FAS), which is taxable and grows with inflation."),
  fasStartAge: z.number().optional().describe("The age at which FAS payments begin."),
});

export type DrawdownOptimizationInput = z.infer<typeof DrawdownOptimizationInputSchema>;

const DrawdownOptimizationOutputSchema = z.object({
  suggestedDrawdownAdjustments: z
    .string()
    .describe(
      'A detailed narrative description of the suggested adjustments to the "DC Pension Drawdown" and "SIPP Drawdown" amounts (columns in the CSV) to aim for a zero DC pension balance and zero SIPP balance near the end of the plan (e.g., age 90). Consider all financial factors provided, including the target annual NET income and how savings (Cash, ISA, GIA - in that order) are used first. Highlight specific years or age ranges where adjustments would be most impactful. Explain the reasoning, considering the goal of depleting both DC and SIPP pots by the projection end age while attempting to meet net income needs and accounting for the growth/depletion of other savings pots and any ongoing DC/SIPP pension contributions.'
    ),
});

export type DrawdownOptimizationOutput = z.infer<typeof DrawdownOptimizationOutputSchema>;

export async function drawdownOptimization(input: DrawdownOptimizationInput): Promise<DrawdownOptimizationOutput> {
  return drawdownOptimizationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'drawdownOptimizationPrompt',
  input: {schema: DrawdownOptimizationInputSchema},
  output: {schema: DrawdownOptimizationOutputSchema},
  prompt: `You are an expert UK pension planner specialising in optimising Uncrystallised Funds Pension Lump Sum (UFPLS) drawdown strategies from Defined Contribution (DC) Pensions and Self-Invested Personal Pensions (SIPPs).
  Your goal is to help the user adjust their 'DC Pension Drawdown' and 'SIPP Drawdown' amounts in the provided pension projection (CSV data) to aim for both 'DC Pension Balance' and 'SIPP Balance' to be zero by approximately age 90, while considering their NET income needs and other savings.

  IMPORTANT: All of your output must be in UK English. For example, use 'optimising' instead of 'utilising'. All financial values must be represented in pounds sterling (£), not dollars ($).

  The projection already incorporates a sophisticated withdrawal strategy. If no upfront 25% tax-free cash was taken, it prioritises pension withdrawals (UFPLS with 25% tax-free) over savings to be tax efficient. If a 25% lump sum was taken, it prioritises using savings (Cash, ISA, GIA) first, as pension withdrawals are fully taxable. In both cases, it attempts to use up the annual Personal Allowance with pension withdrawals if other taxable income doesn't cover it.

  - Cash savings ('Cash Savings Balance' column) do not grow.
  - ISA savings ('ISA Balance' column) grow at {{isaGrowthRate}}% annually.
  - GIA savings ('GIA Balance' column) grow at {{giaGrowthRate}}% annually (tax on GIA growth is not modeled in the projection).

  Analyze the provided pension data CSV. Pay close attention to 'DC Pension Balance', 'DC Pension Drawdown', 'DC Pension Contribution', 'SIPP Balance', 'SIPP Drawdown', 'SIPP Contribution', 'Cash Savings Balance', 'ISA Balance', 'GIA Balance', 'Withdraw from Cash', 'Withdraw from ISA', 'Withdraw from GIA' columns:
  {{pensionDataCsv}}

  Consider these financial parameters for the DC Pension:
  - Initial DC Pension Value (Total Pot before any PCLS and future contributions): {{initialDcPensionValue}}
  {{#if annualDcPensionContribution}}
  - Annual Gross DC Pension Contribution: {{annualDcPensionContribution}} from age {{dcContributionStartAge}} until age {{dcContributionEndAge}}.
  {{/if}}
  {{#if takeTaxFreeLumpSum}}
  - A 25% tax-free lump sum of {{taxFreeLumpSumTaken}} was taken upfront from the DC Pension. The DC pension projection starts with the remaining 75%. Subsequent UFPLS/DC Pension Drawdown withdrawals are fully taxable.
  {{else}}
  - No upfront tax-free lump sum was taken from the DC Pension. Each UFPLS/DC Pension Drawdown withdrawal will have a 25% tax-free element.
  {{/if}}
  - DC Pension Investment Percentage Growth: {{investmentPercentageGrowth}}%
  - DC Pension Annual Management Charge (AMC): {{annualChargeAMC}}%
  - DC Pension UFPLS Withdrawal Rate (current general rate post-SPA if no shortfall or if higher): {{dcWithdrawalRate}}%

  Consider these financial parameters for the SIPP (if applicable, SIPP values might be zero if none):
  - Initial SIPP Value (Total Pot before any PCLS and future contributions): {{initialSippValue}}
  {{#if annualSippContribution}}
  - Annual Gross SIPP Contribution: {{annualSippContribution}} from age {{sippContributionStartAge}} until age {{sippContributionEndAge}}.
  {{/if}}
  {{#if takeSippTaxFreeLumpSum}}
  - A 25% tax-free lump sum of {{sippTaxFreeLumpSumTaken}} was taken upfront from the SIPP. The SIPP projection starts with the remaining 75%. Subsequent UFPLS/SIPP Drawdown withdrawals are fully taxable.
  {{else}}
  - No upfront tax-free lump sum was taken from the SIPP. Each UFPLS/SIPP Drawdown withdrawal will have a 25% tax-free element.
  {{/if}}
  - SIPP Investment Percentage Growth: {{sippInvestmentPercentageGrowth}}%
  - SIPP Annual Management Charge (AMC): {{sippAnnualChargeAMC}}%
  - SIPP UFPLS Withdrawal Rate (current general rate post-SPA if no shortfall or if higher): {{sippWithdrawalRate}}%

  General financial parameters:
  - ISA Growth Rate: {{isaGrowthRate}}%
  - GIA Growth Rate: {{giaGrowthRate}}%
  - Inflation Rate: {{inflationRate}}%
  - State Pension Age: {{statePensionAge}}
  {{#if currentAge}}- Current Age: {{currentAge}}{{/if}}
  {{#if projectionEndAge}}- Projection End Age: {{projectionEndAge}}{{/if}}
  {{#if targetAnnualNetIncome}}- Target Annual Net Income: {{targetAnnualNetIncome}}{{/if}}
  {{#if initialOtherIncome}}- Other Regular Annual Income (inflating): {{initialOtherIncome}}{{/if}}
  {{#if initialFasAmount}}- Financial Assistance Scheme (FAS) Annual Income (inflating): {{initialFasAmount}} starting at age {{fasStartAge}}{{/if}}

  Based on all this information, provide specific, actionable suggestions on how to adjust the 'DC Pension Drawdown' and 'SIPP Drawdown' amounts in different years/ages.
  - The primary goal is to make both 'DC Pension Balance' and 'SIPP Balance' reach near zero by the 'Projection End Age' (e.g., 90).
  - Identify periods where 'DC Pension Drawdown' or 'SIPP Drawdown' might be too low (leading to large remaining balances late in life) or too high (depleting funds too early, unless that's the goal by age 90).
  - Suggest alternative drawdown amounts or strategies for specific age ranges for both DC and SIPP pots.
  - Explain your reasoning clearly, linking to the zero-balance target for both pots, NET income needs, the tax-optimised withdrawal strategy, tax-free lump sum decisions for both pots, ongoing contributions, and all other income sources (DB, State Pension, FAS, Other).
  - Emphasize adjustments that help manage both DC and SIPP pots effectively throughout retirement.
  - The "DC Pension Balance" and "SIPP Balance" columns show the year-end balances. "DC Pension Drawdown" and "SIPP Drawdown" are amounts taken during that year. Contributions are gross amounts added pre-retirement.
  - The AI should suggest changes to the "DC Pension Drawdown" and "SIPP Drawdown" values in the CSV to achieve the zero balance targets.
`,
});

const drawdownOptimizationFlow = ai.defineFlow(
  {
    name: 'drawdownOptimizationFlow',
    inputSchema: DrawdownOptimizationInputSchema,
    outputSchema: DrawdownOptimizationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
