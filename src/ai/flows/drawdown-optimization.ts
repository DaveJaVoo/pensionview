
// drawdown-optimization.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting adjustments to UFPLS drawdown amounts
 *  to help the user aim for a zero balance at the end of their pension plan.
 *
 * - drawdownOptimization - A function that suggests adjustments to UFPLS drawdown amounts.
 * - DrawdownOptimizationInput - The input type for the drawdownOptimization function.
 * - DrawdownOptimizationOutput - The return type for the drawdownOptimization function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema now matches the parameters used in the main app's form for consistency
const DrawdownOptimizationInputSchema = z.object({
  pensionDataCsv: z
    .string()
    .describe('A CSV string containing the user\u2019s pension data, including all calculated columns.'),
  initialDcPensionValue: z.number().describe('The initial value of the DC pension (before any PCLS taken).'),
  takeTaxFreeLumpSum: z.boolean().optional().describe('Whether a 25% tax-free lump sum was taken upfront from the DC pension.'),
  taxFreeLumpSumTaken: z.number().optional().describe('The amount of tax-free lump sum taken, if applicable.'),
  investmentPercentageGrowth: z
    .number()
    .describe('The investment percentage growth rate.'),
  inflationRate: z.number().describe('The inflation rate.'),
  dcWithdrawalRate: z.number().describe('The DC UFPLS withdrawal rate used in the projection (when not meeting a specific income shortfall, or if it results in higher income post-SPA).'), 
  annualChargeAMC: z.number().describe('The annual charge (AMC) as a decimal (e.g., 0.5 for 0.5%).'),
  statePensionAge: z.number().describe('The age at which state pension begins, influencing drawdown needs.'),
  currentAge: z.number().optional().describe('User current age from the projection.'),
  projectionEndAge: z.number().optional().describe('The end age of the projection (e.g. 90).'),
  targetAnnualNetIncome: z.number().optional().describe('The user\'s target annual income AFTER TAX.'), 
});

export type DrawdownOptimizationInput = z.infer<typeof DrawdownOptimizationInputSchema>;

const DrawdownOptimizationOutputSchema = z.object({
  suggestedDrawdownAdjustments: z
    .string()
    .describe(
      'A detailed narrative description of the suggested adjustments to the UFPLS drawdown amounts (column "DC UFPLS Drawdown" in the CSV) to aim for a zero DC pension balance near the end of the plan (e.g., age 90). Consider all financial factors provided, including the target annual NET income and how savings are used first. Highlight specific years or age ranges where adjustments would be most impactful. Explain the reasoning, considering the goal of depleting the DC pot by the projection end age while attempting to meet net income needs.'
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
  prompt: `You are an expert pension planner specializing in optimizing Uncrystallised Funds Pension Lump Sum (UFPLS) drawdown strategies.
  Your goal is to help the user adjust their 'DC UFPLS Drawdown' amounts in the provided pension projection (CSV data) to aim for a DC Pension Balance of zero by approximately age 90, while considering their NET income needs.

  The projection already incorporates a strategy where available savings (from 'Savings Balance' column, which depletes based on 'Withdraw from Savings') are used first to meet the 'Target Annual Net Income' before any DC pension funds are drawn for income shortfall. If savings cover the target, DC drawdown might still occur based on a standard percentage rate post-State Pension Age if that withdrawal is higher.

  Analyze the provided pension data CSV:
  {{pensionDataCsv}}

  Consider these financial parameters used in the projection:
  - Initial DC Pension Value (Total Pot before any PCLS): {{initialDcPensionValue}}
  {{#if takeTaxFreeLumpSum}}
  - A 25% tax-free lump sum of {{taxFreeLumpSumTaken}} was taken upfront. The DC pension projection starts with the remaining 75%. Subsequent UFPLS withdrawals are fully taxable.
  {{else}}
  - No upfront tax-free lump sum was taken. Each UFPLS withdrawal will have a 25% tax-free element.
  {{/if}}
  - Investment Percentage Growth: {{investmentPercentageGrowth}}%
  - Inflation Rate: {{inflationRate}}%
  - DC UFPLS Withdrawal Rate (current general rate post-SPA if no shortfall or if higher): {{dcWithdrawalRate}}%
  - Annual Management Charge (AMC): {{annualChargeAMC}}%
  - State Pension Age: {{statePensionAge}}
  {{#if currentAge}}- Current Age: {{currentAge}}{{/if}}
  {{#if projectionEndAge}}- Projection End Age: {{projectionEndAge}}{{/if}}
  {{#if targetAnnualNetIncome}}- Target Annual Net Income: {{targetAnnualNetIncome}}{{/if}}

  Based on all this information, provide specific, actionable suggestions on how to adjust the 'DC UFPLS Drawdown' amounts in different years/ages.
  - The primary goal is to make the 'DC Pension Balance' reach near zero by the 'Projection End Age' (e.g., 90).
  - Identify periods where 'DC UFPLS Drawdown' might be too low (leading to a large remaining balance late in life) or too high (depleting funds too early, unless that's the goal by age 90).
  - Suggest alternative 'DC UFPLS Drawdown' amounts or strategies for specific age ranges.
  - Explain your reasoning clearly, linking to the zero-balance target, NET income needs (Target Annual Net Income), the use-savings-first strategy, and the tax-free lump sum decision.
  - Emphasize adjustments to 'DC UFPLS Drawdown' that help manage the DC pot effectively throughout retirement.
  - The "DC Pension Balance" column shows the year-end balance. "DC UFPLS Drawdown" is the amount taken during that year.
  - The "Withdraw from Savings" column shows how much cash savings were used to meet the income target. The "Savings Balance" column shows remaining cash savings.
  - The AI should suggest changes to the "DC UFPLS Drawdown" values in the CSV to achieve the zero DC balance target, considering the existing net income strategy and the PCLS choice.
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
