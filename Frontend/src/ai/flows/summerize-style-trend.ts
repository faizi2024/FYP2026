'use server';

/**
 * @fileOverview Summarizes fit feedback from the Honest Fit Algorithm.
 *
 * - summarizeFitFeedback - A function that summarizes the fit feedback.
 * - SummarizeFitFeedbackInput - The input type for the summarizeFitFeedback function.
 * - SummarizeFitFeedbackOutput - The return type for the summarizeFitFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeFitFeedbackInputSchema = z.object({
  feedback: z.string().describe('The detailed feedback from the Honest Fit Algorithm, indicating areas of tightness or looseness.'),
});

export type SummarizeFitFeedbackInput = z.infer<typeof SummarizeFitFeedbackInputSchema>;

const SummarizeFitFeedbackOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the fit feedback, highlighting key areas of concern.'),
});

export type SummarizeFitFeedbackOutput = z.infer<typeof SummarizeFitFeedbackOutputSchema>;

export async function summarizeFitFeedback(input: SummarizeFitFeedbackInput): Promise<SummarizeFitFeedbackOutput> {
  return summarizeFitFeedbackFlow(input);
}

const summarizeFitFeedbackPrompt = ai.definePrompt({
  name: 'summarizeFitFeedbackPrompt',
  input: {schema: SummarizeFitFeedbackInputSchema},
  output: {schema: SummarizeFitFeedbackOutputSchema},
  prompt: `You are an AI assistant that summarizes fit feedback for garments.

  Given the following feedback from the Honest Fit Algorithm, provide a concise summary of the key areas where the garment may be too tight or loose. Focus on the most important fit implications.

  Feedback: {{{feedback}}}
  `,
});

const summarizeFitFeedbackFlow = ai.defineFlow(
  {
    name: 'summarizeFitFeedbackFlow',
    inputSchema: SummarizeFitFeedbackInputSchema,
    outputSchema: SummarizeFitFeedbackOutputSchema,
  },
  async input => {
    const {output} = await summarizeFitFeedbackPrompt(input);
    return output!;
  }
);
