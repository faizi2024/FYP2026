'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { generateGarmentSuggestions,  } from './generate-garment-suggestions';

// ... (Your Schema definitions)

// MAKE SURE THIS NAME MATCHES YOUR IMPORT
export async function generateOutfitSuggestions(
  input: Parameters<typeof generateGarmentSuggestions>[0]
): Promise<import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  // Setting this globally helps prevent the 404 error
  model: 'googleai/gemini-1.5-flash', 
});> {
  return generateOutfitSuggestionsFlow(input);
}

const generateOutfitSuggestionsFlow = ai.defineFlow(
  {
    name: 'generateOutfitSuggestionsFlow',
    // ...
  },
  async (input) => {
    // ... logic
  }
);