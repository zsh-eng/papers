/**
 * Gemini API client initialization.
 */

import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

/**
 * Get or create Gemini client.
 * Reads API key from GEMINI_API_KEY environment variable.
 */
export function getGeminiClient(): GoogleGenAI {
  if (client) {
    return client;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is required. " +
        "Get your API key at https://aistudio.google.com/apikey",
    );
  }

  client = new GoogleGenAI({ apiKey });
  return client;
}

/** Model to use for extraction */
export const EXTRACTION_MODEL = "gemini-3-flash-preview";
