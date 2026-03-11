/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Content } from '@google/genai';
import { destinations } from '../data/destinations';

const API_KEY = process.env.GEMINI_API_KEY;

export const AVAILABLE_GEMINI_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const;

export type GeminiModel = (typeof AVAILABLE_GEMINI_MODELS)[number];

function resolveModel(model?: string): GeminiModel {
  return AVAILABLE_GEMINI_MODELS.includes(model as GeminiModel)
    ? (model as GeminiModel)
    : 'gemini-2.5-pro';
}

let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY! });
  }
  return ai;
}

export interface TripParams {
  origin: string;
  budget: number;
  duration: number;
  season: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface TourStop {
  destinationId: string;
  narration: string;
}

export interface AIResponse {
  assistantResponse: string;
  suggestedDestinationIds: string[];
  suggestedPrices: Record<string, number>; // destinationId -> estimated round-trip price USD
  updatedParams: Partial<TripParams>;
  tourScript: TourStop[];
}

interface ExaContextPayload {
  highlights?: string[];
  sources?: { title?: string; url?: string }[];
}

async function fetchExaTravelContext(
  message: string,
  currentParams: TripParams
): Promise<string> {
  const query = `Travel itinerary and flight planning context for a user traveling from ${currentParams.origin || 'unknown origin'} with budget ${currentParams.budget} USD for ${currentParams.duration} days in ${currentParams.season}. User request: ${message}`;

  try {
    const response = await fetch('/api/exa/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        numResults: 6,
        maxHighlightChars: 500,
      }),
    });

    if (!response.ok) {
      return '';
    }

    const payload = (await response.json()) as ExaContextPayload;
    const highlights = Array.isArray(payload.highlights)
      ? payload.highlights.filter((h): h is string => typeof h === 'string').slice(0, 8)
      : [];

    const sources = Array.isArray(payload.sources)
      ? payload.sources
          .filter(
            (s): s is { title?: string; url: string } =>
              !!s && typeof s.url === 'string' && s.url.length > 0
          )
          .slice(0, 5)
      : [];

    if (highlights.length === 0) {
      return '';
    }

    const highlightsText = highlights.map((h) => `- ${h}`).join('\n');
    const sourcesText = sources
      .map((s) => `- ${s.title && s.title.length > 0 ? s.title : 'Source'}: ${s.url}`)
      .join('\n');

    return `[Live travel context from Exa]\n${highlightsText}${sourcesText ? `\nSources:\n${sourcesText}` : ''}`;
  } catch (error) {
    console.warn('Exa context fetch failed. Continuing without Exa grounding.', error);
    return '';
  }
}

// Build the destination index summary for the system prompt
function buildDestinationIndex(): string {
  return destinations
    .map(
      (d) =>
        `• id="${d.id}" | ${d.name}, ${d.country} [${d.region}] | Budget: ${d.estimatedBudgetLevel} | Tags: ${d.tags.join(', ')}`
    )
    .join('\n');
}

const SYSTEM_PROMPT = `You are Atlas, a sophisticated AI travel companion with the wit of a seasoned foreign correspondent and the knowledge of a veteran travel editor. You help users discover destinations and build custom itineraries.

AVAILABLE DESTINATIONS (use exact IDs when referencing these):
${buildDestinationIndex()}

RESPONSE FORMAT:
You MUST ALWAYS respond with a valid JSON object exactly matching this structure:
{
  "assistantResponse": "Your conversational response shown in the chat. 1-3 sentences. Bold destination names with **name**.",
  "suggestedDestinationIds": ["id1", "id2", "id3"],
  "suggestedPrices": {"id1": 450, "id2": 720, "id3": 380},
  "updatedParams": {
    "budget": 2500,
    "duration": 10,
    "season": "spring",
    "origin": "London"
  },
  "tourScript": [
    {
      "destinationId": "paris",
      "narration": "A 1-3 sentence spoken narration for this destination as a knowledgeable guide pausing over it on the map. Conversational, vivid, personal. Include a practical detail — flight time, price range, or best season."
    }
  ]
}

RULES:
- assistantResponse: ALWAYS required, NEVER empty. Friendly summary of what Atlas is showing.
- suggestedDestinationIds: 3-4 destination IDs from the list that match the request. Return [] only for purely conversational messages.
- suggestedPrices: For each suggested destination, include an estimated round-trip economy airfare from the user's origin city in USD (integer). Use realistic 2024 price ranges. Return {} for conversational messages.
- updatedParams: ONLY include fields explicitly mentioned by the user. Return {} if nothing changed.
- tourScript: When suggesting destinations, ALWAYS include a tourScript entry for EACH suggestedDestinationId (same order). The narration should feel like a knowledgeable friend leaning over a map and pointing — warm, specific, never generic brochure-speak. 1-3 sentences max. Include ONE concrete practical fact (cost, flight time, best season, crowd tip). Return [] only for conversational messages with no destination suggestions.
- budget is an integer in USD (total trip budget)
- duration is an integer number of days
- season is one of: "spring", "summer", "fall", "winter", "year-round"
- Suggest destinations across different regions for diversity
- $500-2000 → budget; $2000-5000 → moderate; $5000+ → luxury

IMPORTANT: Return ONLY the JSON object. No markdown fences, no extra text.`;

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  currentParams: TripParams,
  selectedModel?: string
): Promise<AIResponse> {
  if (!API_KEY) {
    return {
      assistantResponse:
        'Atlas requires a Gemini API key to operate. Please add your GEMINI_API_KEY to the environment configuration.',
      suggestedDestinationIds: [],
      suggestedPrices: {},
      updatedParams: {},
      tourScript: [],
    };
  }

  // Build conversation history in Gemini format
  const geminiHistory: Content[] = history.slice(-12).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const contextPrefix = `[Current trip parameters: Origin="${currentParams.origin || 'Not set'}", Budget=$${currentParams.budget}, Duration=${currentParams.duration} days, Season=${currentParams.season}]\n\nUser message: ${message}`;

  const allContents: Content[] = [
    ...geminiHistory,
    {
      role: 'user',
      parts: [{ text: contextPrefix }],
    },
  ];

  try {
    const client = getAI();
    const modelToUse = resolveModel(selectedModel);
    const response = await client.models.generateContent({
      model: modelToUse,
      contents: allContents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text?.trim() ?? '';

    // Extract JSON efficiently by finding the outermost braces
    let jsonText = raw;
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      jsonText = raw.substring(firstBrace, lastBrace + 1);
    } else {
      console.warn("Could not find robust JSON boundaries in AI response. Attempting raw parse.", { raw });
    }
    
    console.log("Extracted JSON text intended for parsing:", jsonText);

    let parsed: any = {};
    try {
      if (!jsonText) throw new Error("Empty jsonText");
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Failed to parse JSON text from AI response. JSON text:", jsonText, "Raw response:", raw);
      throw new Error("Invalid response format from AI");
    }

    const validIds = new Set(destinations.map((d) => d.id));
    return {
      assistantResponse:
        typeof parsed.assistantResponse === 'string' && parsed.assistantResponse.length > 0
          ? parsed.assistantResponse
          : 'I found some great options for you. Explore the highlighted destinations on the map.',
      suggestedDestinationIds: Array.isArray(parsed.suggestedDestinationIds)
        ? parsed.suggestedDestinationIds
            .filter((id) => validIds.has(id))
            .slice(0, 4)
        : [],
      suggestedPrices:
        parsed.suggestedPrices && typeof parsed.suggestedPrices === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.suggestedPrices)
                .filter(([id, v]) => validIds.has(id) && typeof v === 'number')
                .map(([id, v]) => [id, Math.round(v as number)])
            )
          : {},
      updatedParams:
        parsed.updatedParams && typeof parsed.updatedParams === 'object'
          ? parsed.updatedParams
          : {},
      tourScript: Array.isArray(parsed.tourScript)
        ? parsed.tourScript.filter(
            (s): s is TourStop =>
              s &&
              typeof s.destinationId === 'string' &&
              validIds.has(s.destinationId) &&
              typeof s.narration === 'string'
          )
        : [],
    };
  } catch (error) {
    console.error('Atlas AI error:', error);
    return {
      assistantResponse:
        "The signal was lost somewhere over the Atlantic. Try again — Atlas never gives up on finding you the perfect journey.",
      suggestedDestinationIds: [],
      suggestedPrices: {},
      updatedParams: {},
      tourScript: [],
    };
  }
}

export function getQuickSuggestions(): string[] {
  return [
    'Beach destinations in Europe under $3000',
    'Plan a 7-day solo trip to Japan',
    'Best destinations for adventure travel',
    'Romantic cities for a honeymoon',
    'Budget travel in Southeast Asia',
    'Where should I go for 10 days in fall?',
  ];
}
