'use server';

import { ai } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { 
  GarmentSuggestionInputSchema, 
  GarmentSuggestionOutputSchema,
  GarmentSuggestionInput,
  GarmentSuggestionOutput 
} from '@/lib/types';

// 1. Define the internal Prompt (Private to this file)
const garmentPrompt = ai.definePrompt({
  name: 'garmentSuggestionPrompt',
  input: { schema: GarmentSuggestionInputSchema },
  output: { schema: GarmentSuggestionOutputSchema },
  model: gemini15Flash,
  prompt: `You are a high-end AI Fashion Stylist. 
  ANALYSIS: H:{{heightCm}}cm, W:{{weightKg}}kg, C:{{chestCm}}cm.
  Suggest 3-5 unique items with Hex codes for their profile.`,
});

// 2. Define the internal Flow (Private to this file)
const garmentFlow = ai.defineFlow(
  {
    name: 'garmentSuggestionFlow',
    inputSchema: GarmentSuggestionInputSchema,
    outputSchema: GarmentSuggestionOutputSchema,
  },
  async (input) => {
    const { output } = await garmentPrompt(input, { config: { temperature: 0.8 } });
    if (!output || output.suggestions.length === 0) throw new Error("No AI Output");
    return output;
  }
);

// 3. THE EXPORTED SERVER ACTION (The only thing the UI sees)
// This MUST be an async function to satisfy Next.js "use server" rules
export async function getGarmentSuggestions(input: GarmentSuggestionInput): Promise<GarmentSuggestionOutput> {
  try {
    // We call the internal flow here
    return await garmentFlow(input);
  } catch (error) {
    console.error("AI Flow Error - Using Fallback:", error);
    
    // Simple Fallback
    return {
      suggestions: [{
        garmentName: "Navy Oxford Shirt",
        garmentType: "top",
        suggestedColor: "#000080",
        colorReasoning: "A timeless classic that fits your measurements.",
        fitNotes: `Optimized for ${input.heightCm}cm height.`,
        styleNotes: "Fallback suggestion due to connection error.",
        occasion: "Business Casual"
      }]
    };
  }
}