'use server';

import { ai } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { 
  GarmentSuggestionInputSchema, 
  GarmentSuggestionOutputSchema,
  GarmentSuggestionInput,
  GarmentSuggestionOutput 
} from '@/lib/types';

// Prompt is internal (not exported), so it's safe
const prompt = ai.definePrompt({
  name: 'garmentSuggestionPrompt',
  input: { schema: GarmentSuggestionInputSchema },
  output: { schema: GarmentSuggestionOutputSchema },
  model: gemini15Flash, 
  prompt: `You are a high-end AI Fashion Stylist. 
  ANALYSIS: H:{{heightCm}}cm, W:{{weightKg}}kg, C:{{chestCm}}cm.
  Suggest unique items with Hex codes.`,
});

// THIS is the function your UI will call
export async function getGarmentSuggestions(input: GarmentSuggestionInput) {
  try {
    const { output } = await prompt(input, { config: { temperature: 0.8 } });
    
    if (!output || output.suggestions.length === 0) throw new Error("No AI Output");
    return output;
  } catch (error) {
    console.error("AI Flow Error:", error);
    return getSmartFallback(input);
  }
}

// Fallback is private
function getSmartFallback(input: GarmentSuggestionInput): GarmentSuggestionOutput {
  return {
    suggestions: [
      {
        garmentName: "Navy Oxford Shirt",
        garmentType: "top",
        suggestedColor: "#000080",
        colorReasoning: "Classic professional look.",
        fitNotes: `Size optimized for ${input.heightCm}cm frame.`,
        styleNotes: "Fallback suggestion.",
        occasion: "Business Casual"
      }
    ]
  };
}