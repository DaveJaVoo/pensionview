// pension-insights.ts
'use server';
/**
 * @fileOverview Generates insights based on pension data.
 *
 * - generatePensionInsights - A function that generates insights based on the pension data.
 * - PensionInsightsInput - The input type for the generatePensionInsights function.
 * - PensionInsightsOutput - The return type for the generatePensionInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PensionInsightsInputSchema = z.string().describe('The pension data in CSV format.');
export type PensionInsightsInput = z.infer<typeof PensionInsightsInputSchema>;

const PensionInsightsOutputSchema = z.object({
  insights: z.string().describe('AI-generated insights based on the pension data.'),
});
export type PensionInsightsOutput = z.infer<typeof PensionInsightsOutputSchema>;

export async function generatePensionInsights(input: PensionInsightsInput): Promise<PensionInsightsOutput> {
  return pensionInsightsFlow(input);
}

const pensionInsightsPrompt = ai.definePrompt({
  name: 'pensionInsightsPrompt',
  input: {schema: PensionInsightsInputSchema},
  output: {schema: PensionInsightsOutputSchema},
  prompt: `You are an AI assistant that analyzes pension data and provides key insights.
  Analyze the following pension data and provide insights, including potential issues and trends.
  
  Pension Data:\n{{{input}}}
  
  Insights:`,
});

const pensionInsightsFlow = ai.defineFlow(
  {
    name: 'pensionInsightsFlow',
    inputSchema: PensionInsightsInputSchema,
    outputSchema: PensionInsightsOutputSchema,
  },
  async input => {
    const {output} = await pensionInsightsPrompt({input: input});
    return output!;
  }
);
