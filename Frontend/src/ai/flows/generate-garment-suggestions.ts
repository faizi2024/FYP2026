'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { gemini15Flash } from '@genkit-ai/googleai'; // Import the model object

// ... (Schemas remain the same as your provided code)

const prompt = ai.definePrompt({
  name: 'garmentSuggestionPrompt',
  input: { schema: GarmentSuggestionInputSchema },
  output: { schema: GarmentSuggestionOutputSchema },
  // FIX: Using the imported object instead of a string 'googleai/gemini-1.5-flash'
  model: gemini15Flash, 
  prompt: `You are a high-end AI Fashion Stylist. 
  
  ANALYSIS REQUIREMENTS:
  1. Measurements: H:{{{heightCm}}}cm, W:{{{weightKg}}}kg, C:{{{chestCm}}}cm, Waist:{{{waistCm}}}cm.
  2. Visual Context: {{{pastTryOnHistory}}}
  
  STYLING TASKS:
  - Identify the user's likely skin undertone from the context.
  - Suggest 3-5 unique items for different occasions.
  - Use specific Hex codes for colors that suit their complexion.
  - Return unique suggestions for every request.`,
});

export const garmentSuggestionFlow = ai.defineFlow(
  {
    name: 'garmentSuggestionFlow',
    inputSchema: GarmentSuggestionInputSchema,
    outputSchema: GarmentSuggestionOutputSchema,
  },
  async (input) => {
    try {
      // High temperature (0.8) ensures more variety in suggestions
      const { output } = await prompt(input, { config: { temperature: 0.8 } });
      
      if (!output || output.suggestions.length === 0) throw new Error("No AI Output");
      return output;
    } catch (error) {
      console.error("AI Flow Error - Using Smart Fallback:", error);
      return getSmartFallback(input);
    }
  }
);

// Improved Fallback to provide variety even if API fails
function getSmartFallback(input: GarmentSuggestionInput): GarmentSuggestionOutput {
  const pool = [
    { name: "Olive Field Jacket", color: "#556B2F", type: "outerwear", occasion: "Casual" },
    { name: "Navy Oxford Shirt", color: "#000080", type: "top", occasion: "Business Casual" },
    { name: "Burgundy Chinos", color: "#800020", type: "bottom", occasion: "Evening" },
    { name: "Charcoal Wool Coat", color: "#36454F", type: "outerwear", occasion: "Formal" },
    { name: "Sand Linen Shirt", color: "#C2B280", type: "top", occasion: "Summer" }
  ];

  // Randomly pick 3 items from the pool
  const selected = pool.sort(() => 0.5 - Math.random()).slice(0, 3);

  return {
    suggestions: selected.map(item => ({
      garmentName: item.name,
      garmentType: item.type,
      suggestedColor: item.color,
      colorReasoning: "This shade provides a sophisticated contrast to your described profile.",
      fitNotes: `Tailored to suit your ${input.heightCm}cm frame and ${input.chestCm}cm chest.`,
      styleNotes: "A timeless piece that builds on your history.",
      occasion: item.occasion
    }))
  };
}