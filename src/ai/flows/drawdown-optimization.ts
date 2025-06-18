
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
  initialDcPensionValue: z.number().describe('The initial value of the DC pension.'),
  investmentPercentageGrowth: z
    .number()
    .describe('The investment percentage growth rate.'),
  inflationRate: z.number().describe('The inflation rate.'),
  // dcWithdrawalRate is more relevant than a generic withdrawalRate for this AI.
  dcWithdrawalRate: z.number().describe('The DC UFPLS withdrawal rate used in the projection.'), 
  annualChargeAMC: z.number().describe('The annual charge (AMC) as a decimal (e.g., 0.5 for 0.5%).'),
  statePensionAge: z.number().describe('The age at which state pension begins, influencing drawdown needs.'),
  // Adding current age and projection end age might give context to the AI
  currentAge: z.number().optional().describe('User current age from the projection.'),
  projectionEndAge: z.number().optional().describe('The end age of the projection (e.g. 90).'),
});

export type DrawdownOptimizationInput = z.infer<typeof DrawdownOptimizationInputSchema>;

const DrawdownOptimizationOutputSchema = z.object({
  suggestedDrawdownAdjustments: z
    .string()
    .describe(
      'A detailed narrative description of the suggested adjustments to the UFPLS drawdown amounts (column "DC UFPLS Drawdown" in the CSV) to aim for a zero DC pension balance near the end of the plan (e.g., age 90). Consider all financial factors provided. Highlight specific years or age ranges where adjustments would be most impactful. Explain the reasoning, considering the goal of depleting the DC pot by the projection end age.'
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
  Your goal is to help the user adjust their 'DC UFPLS Drawdown' amounts in the provided pension projection (CSV data) to aim for a DC Pension Balance of zero by approximately age 90.

  Analyze the provided pension data CSV:
  {{pensionDataCsv}}

  Consider these financial parameters used in the projection:
  - Initial DC Pension Value: {{initialDcPensionValue}}
  - Investment Percentage Growth: {{investmentPercentageGrowth}}%
  - Inflation Rate: {{inflationRate}}%
  - DC UFPLS Withdrawal Rate (current general rate post-SPA): {{dcWithdrawalRate}}%
  - Annual Management Charge (AMC): {{annualChargeAMC}}%
  - State Pension Age: {{statePensionAge}}
  {{#if currentAge}}- Current Age: {{currentAge}}{{/if}}
  {{#if projectionEndAge}}- Projection End Age: {{projectionEndAge}}{{/if}}

  Based on all this information, provide specific, actionable suggestions on how to adjust the 'DC UFPLS Drawdown' amounts in different years/ages.
  - Identify periods where drawdown might be too low (leading to a large remaining balance) or too high (depleting funds too early, unless that's the goal by age 90).
  - Suggest alternative drawdown amounts or strategies for specific age ranges.
  - Explain your reasoning clearly, always linking back to the goal of achieving a near-zero DC balance by the end of the projection period (age 90).
  - Emphasize adjustments that help manage the DC pot effectively throughout retirement to meet this zero-balance target.
  - Be very specific about which years or age ranges in the 'DC UFPLS Drawdown' column of the CSV should be modified.
  - The "DC Pension Balance" column in the CSV shows the year-end balance. The "DC UFPLS Drawdown" is the amount taken during that year.
  - The AI should suggest changes to the "DC UFPLS Drawdown" values in the CSV to achieve the target.
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
