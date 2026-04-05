import { z } from 'genkit';

// 1. Define the Schemas
export const GarmentSuggestionInputSchema = z.object({
  heightCm: z.number(),
  weightKg: z.number(),
  chestCm: z.number(),
  waistCm: z.number(),
  pastTryOnHistory: z.string().optional(),
});

export const GarmentSuggestionOutputSchema = z.object({
  suggestions: z.array(z.object({
    garmentName: z.string(),
    garmentType: z.string(),
    suggestedColor: z.string(),
    colorReasoning: z.string(),
    fitNotes: z.string(),
    styleNotes: z.string(),
    occasion: z.string()
  }))
});

// 2. Export types for use in functions
export type GarmentSuggestionInput = z.infer<typeof GarmentSuggestionInputSchema>;
export type GarmentSuggestionOutput = z.infer<typeof GarmentSuggestionOutputSchema>;