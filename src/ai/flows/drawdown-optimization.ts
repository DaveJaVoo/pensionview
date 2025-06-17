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

const DrawdownOptimizationInputSchema = z.object({
  pensionDataCsv: z
    .string()
    .describe('A CSV string containing the user\u2019s pension data.'),
  initialDcPensionValue: z.number().describe('The initial value of the DC pension.'),
  investmentPercentageGrowth: z
    .number()
    .describe('The investment percentage growth rate.'),
  inflationRate: z.number().describe('The inflation rate.'),
  withdrawalRate: z.number().describe('The withdrawal rate.'),
  annualChargeAMC: z.number().describe('The annual charge (AMC) as a decimal.'),
});

export type DrawdownOptimizationInput = z.infer<typeof DrawdownOptimizationInputSchema>;

const DrawdownOptimizationOutputSchema = z.object({
  suggestedDrawdownAdjustments: z
    .string()
    .describe(
      'A description of the suggested adjustments to the UFPLS drawdown amounts to aim for a zero balance at the end of the plan, considering all factors.'
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
  prompt: `You are an expert pension planner, helping users optimize their UFPLS drawdown amounts.

  Based on the provided pension data, suggest adjustments to the UFPLS drawdown amounts to aim for a zero balance at the end of the plan.
  Consider the initial pension value, investment growth rate, inflation rate, withdrawal rate, and annual charges.

  Here's the pension data in CSV format:
  {{pensionDataCsv}}

  Here are the financial parameters:
  Initial DC Pension Value: {{initialDcPensionValue}}
  Investment Percentage Growth: {{investmentPercentageGrowth}}
  Inflation Rate: {{inflationRate}}
  Withdrawal Rate: {{withdrawalRate}}
  Annual Charge (AMC): {{annualChargeAMC}}

  Provide a detailed explanation of the suggested drawdown adjustments, considering all these factors.
  The goal is to end with a zero balance.
  Ensure that you give an explanation that considers the user's goal to end with zero.
  Make sure to include specific example years from the dataset, where changes to drawdown would be most impactful.
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
