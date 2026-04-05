'use server';

import {
  generateOutfitSuggestions,
  GenerateOutfitSuggestionsInput,
  GenerateOutfitSuggestionsOutput,
} from '@/ai/flows/generate-garment-suggestions';

export async function getOutfitSuggestions(
  input: GenerateOutfitSuggestionsInput
): Promise<GenerateOutfitSuggestionsOutput> {
  // Basic validation for the data URI
  if (!input.photoDataUri.startsWith('data:image/')) {
    throw new Error('Invalid image format. Please upload a valid image file.');
  }

  try {
    const result = await generateOutfitSuggestions(input);
    
    if (!result || !result.suggestions || result.suggestions.length === 0) {
        throw new Error("The AI couldn't generate any suggestions. Try a different photo.");
    }
    return result;
  } catch (error) {
    console.error('Error in getOutfitSuggestions server action:', error);
    throw new Error('Failed to get suggestions from AI. Please check the image and try again.');
  }
}