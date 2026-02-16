/**
 * Gemini API client initialization.
 */

import type { GenerateContentConfig } from "@google/genai";
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

/** Primary model for extraction */
export const EXTRACTION_MODEL = "gemini-3-flash-preview";

/** Fallback models to try when primary model blocks content */
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
] as const;

/**
 * Generate content with automatic model fallback on PROHIBITED_CONTENT blocks.
 */
export async function generateContentWithFallback(options: {
  contents: Parameters<GoogleGenAI["models"]["generateContent"]>[0]["contents"];
  config?: GenerateContentConfig;
}) {
  const client = getGeminiClient();
  const models = [EXTRACTION_MODEL, ...FALLBACK_MODELS];

  for (const model of models) {
    const response = await client.models.generateContent({
      model,
      contents: options.contents,
      config: {
        ...options.config,
        safetySettings: [
          ...SAFETY_SETTINGS,
        ],
      },
    });

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason === "PROHIBITED_CONTENT" && model !== models.at(-1)) {
      console.error(
        `Model ${model} blocked content (PROHIBITED_CONTENT), trying next model...`,
      );
      continue;
    }

    return response;
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("All models exhausted");
}
