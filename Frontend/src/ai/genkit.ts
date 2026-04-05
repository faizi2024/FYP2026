import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      // Explicitly forcing v1 can often bypass the beta 404 error
      apiVersion: 'v1', 
    }),
  ],
  // Setting the default model as an object reference
  model: gemini15Flash, 
});