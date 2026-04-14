/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Content } from '@google/genai';
import { destinations } from '../data/destinations';

// NOTE: sendChatMessageReAct implements a formal ReAct (Reason + Act) loop.
// It allows the LLM to call tools iteratively before returning a final response.
// See: https://arxiv.org/abs/2210.03629

const API_KEY = process.env.GEMINI_API_KEY;

export const AVAILABLE_GEMINI_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const;

export type GeminiModel = (typeof AVAILABLE_GEMINI_MODELS)[number];

/** GMI Cloud model identifiers — fallback list used until backend responds. */
export let AVAILABLE_GMI_MODELS: string[] = [
  'deepseek-ai/DeepSeek-R1',
  'meta-llama/Meta-Llama-3.3-70B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct',
];

export type GmiModel = string;

/** Fetch the authoritative GMI model list from the backend (single source of truth). */
export async function fetchGmiModels(): Promise<string[]> {
  try {
    const resp = await fetch('/api/gmi/models');
    if (resp.ok) {
      const data = (await resp.json()) as { models?: string[] };
      if (Array.isArray(data.models) && data.models.length > 0) {
        AVAILABLE_GMI_MODELS = data.models;
      }
    }
  } catch {
    console.warn('Could not fetch GMI models from backend. Using fallback list.');
  }
  return AVAILABLE_GMI_MODELS;
}

/** Returns true when the selected model should be routed to GMI Cloud. */
export function isGmiModel(model: string): boolean {
  return AVAILABLE_GMI_MODELS.includes(model);
}

function resolveGeminiModel(model?: string): GeminiModel {
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

// ── Shared response parser ────────────────────────────────────────────────────

/**
 * Parse raw LLM output into a validated AIResponse.
 * Extracts the outermost JSON object, validates destination IDs, and applies
 * sensible defaults so callers never receive malformed data.
 */
function parseAIResponse(raw: string): AIResponse {
  let jsonText = raw;
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    jsonText = raw.substring(firstBrace, lastBrace + 1);
  } else {
    console.warn('Could not find JSON boundaries in AI response. Attempting raw parse.', { raw });
  }

  let parsed: Record<string, unknown> = {};
  try {
    if (!jsonText) throw new Error('Empty response text');
    parsed = JSON.parse(jsonText);
  } catch (parseError) {
    console.error('Failed to parse AI response JSON:', jsonText);
    throw new Error('Invalid JSON response from AI');
  }

  const validIds = new Set(destinations.map((d) => d.id));
  return {
    assistantResponse:
      typeof parsed.assistantResponse === 'string' && (parsed.assistantResponse as string).length > 0
        ? (parsed.assistantResponse as string)
        : 'I found some great options for you. Explore the highlighted destinations on the map.',
    suggestedDestinationIds: Array.isArray(parsed.suggestedDestinationIds)
      ? (parsed.suggestedDestinationIds as string[]).filter((id) => validIds.has(id)).slice(0, 4)
      : [],
    suggestedPrices:
      parsed.suggestedPrices && typeof parsed.suggestedPrices === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.suggestedPrices as Record<string, unknown>)
              .filter(([id, v]) => validIds.has(id) && typeof v === 'number')
              .map(([id, v]) => [id, Math.round(v as number)])
          )
        : {},
    updatedParams:
      parsed.updatedParams && typeof parsed.updatedParams === 'object'
        ? (parsed.updatedParams as Partial<TripParams>)
        : {},
    tourScript: Array.isArray(parsed.tourScript)
      ? (parsed.tourScript as TourStop[]).filter(
          (s): s is TourStop =>
            s &&
            typeof s.destinationId === 'string' &&
            validIds.has(s.destinationId) &&
            typeof s.narration === 'string'
        )
      : [],
  };
}

/**
 * Build the user-message prefix containing current trip parameters and
 * optional Exa-grounded travel context.
 */
function buildContextPrefix(
  message: string,
  currentParams: TripParams,
  exaContext: string
): string {
  const paramsBlock = `[Current trip parameters: Origin="${currentParams.origin || 'Not set'}", Budget=$${currentParams.budget}, Duration=${currentParams.duration} days, Season=${currentParams.season}]`;
  const exaBlock = exaContext ? `\n\n${exaContext}` : '';
  return `${paramsBlock}${exaBlock}\n\nUser message: ${message}`;
}

// ── ReAct Tool Registry ────────────────────────────────────────────────────
// Tools the LLM can call during a ReAct reasoning loop.
// Each tool has a name, description, and an async execute function.

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  tool: string;
  result: string;
}

const TOOLS = [
  {
    name: 'search_travel_context',
    description: 'Search for live travel information, flight prices, or destination details.',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query for travel context.' },
      },
      required: ['query'],
    },
  },
];

async function dispatchTool(call: ToolCall, currentParams: TripParams): Promise<ToolResult> {
  if (call.name === 'search_travel_context') {
    const query = String(call.args.query ?? '');
    const context = await fetchExaTravelContext(query, currentParams);
    return { tool: call.name, result: context || 'No results found.' };
  }
  return { tool: call.name, result: `Unknown tool: ${call.name}` };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  currentParams: TripParams,
  selectedModel?: string
): Promise<AIResponse> {
  // Route to GMI Cloud if a GMI model is selected
  if (selectedModel && isGmiModel(selectedModel)) {
    return sendGmiCloudMessage(message, history, currentParams, selectedModel);
  }

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

  try {
    // Fetch live travel context from Exa (non-blocking — gracefully returns '' on failure)
    const exaContext = await fetchExaTravelContext(message, currentParams);

    // Build conversation history in Gemini format
    const geminiHistory: Content[] = history.slice(-12).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const contextPrefix = buildContextPrefix(message, currentParams, exaContext);

    const allContents: Content[] = [
      ...geminiHistory,
      { role: 'user', parts: [{ text: contextPrefix }] },
    ];

    const client = getAI();
    const modelToUse = resolveGeminiModel(selectedModel);
    const response = await client.models.generateContent({
      model: modelToUse,
      contents: allContents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text?.trim() ?? '';
    return parseAIResponse(raw);
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

// ── ReAct Loop ───────────────────────────────────────────────────────────────

/**
 * ReAct-style chat: the LLM can call tools during reasoning before
 * returning a final answer. Up to MAX_REACT_STEPS tool calls are allowed.
 *
 * NOTE: The ReAct loop is only active for GMI Cloud models. For Gemini models,
 * this function delegates immediately to sendChatMessage (Gemini uses its own
 * native function-calling mechanism rather than the text-based tool_call format).
 *
 * Loop:
 *   1. Call LLM with tools defined in the system prompt
 *   2. If the response contains a tool_call JSON block, execute the tool
 *   3. Inject the tool result as a new "observation" message
 *   4. Repeat until the LLM returns a plain answer or MAX_REACT_STEPS is reached
 */
const MAX_REACT_STEPS = 3;

const REACT_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

You have access to the following tools. When you need live data, respond with ONLY a JSON tool call block — no other text:
\`\`\`tool_call
{"name": "search_travel_context", "args": {"query": "<your search query>"}}
\`\`\`

After receiving a tool result (prefixed with [Tool Result:]), incorporate it into your final answer.
Always end with a plain language response to the user.`;

/** Type guard for params objects that carry an optional selectedModel field. */
function hasSelectedModel(params: TripParams): params is TripParams & { selectedModel: string } {
  return (
    'selectedModel' in params &&
    typeof (params as TripParams & { selectedModel?: unknown }).selectedModel === 'string'
  );
}

export async function sendChatMessageReAct(
  message: string,
  history: ChatMessage[],
  currentParams: TripParams,
): Promise<AIResponse> {
  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.slice(-8).map((msg) => ({
      role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content,
    })),
    { role: 'user', content: message },
  ];

  let steps = 0;

  while (steps < MAX_REACT_STEPS) {
    steps++;

    // Build the messages array for this iteration
    const messages = [
      { role: 'system' as const, content: REACT_SYSTEM_PROMPT },
      ...conversationHistory,
    ];

    // Call the LLM (OpenAI-compatible path via GMI or Gemini)
    let rawResponse: string;
    try {
      const selectedModel = hasSelectedModel(currentParams) ? currentParams.selectedModel : undefined;
      if (selectedModel && isGmiModel(selectedModel)) {
        // Use GMI path
        const resp = await fetch('/api/gmi/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, model: selectedModel }),
        });
        const data = await resp.json();
        rawResponse = data?.choices?.[0]?.message?.content ?? '';
      } else {
        // Use Gemini path
        const exaContext = await fetchExaTravelContext(message, currentParams);
        const contextPrefix = buildContextPrefix(message, currentParams, exaContext);
        // For Gemini, fall through to standard path on first step only
        return sendChatMessage(contextPrefix + message, history, currentParams);
      }
    } catch (err) {
      console.warn('[ReAct] LLM call failed, falling back to standard path.', err);
      break;
    }

    // Check if the LLM wants to call a tool
    const toolCallMatch = rawResponse.match(/```tool_call\s*([\s\S]*?)```/);
    if (toolCallMatch) {
      try {
        const toolCall: ToolCall = JSON.parse(toolCallMatch[1].trim());
        console.log(`[ReAct] Step ${steps}: calling tool '${toolCall.name}'`, toolCall.args);

        const toolResult = await dispatchTool(toolCall, currentParams);
        console.log(`[ReAct] Step ${steps}: tool result received`, { tool: toolResult.tool });

        // Inject assistant's tool call and the observation into the conversation
        conversationHistory.push({ role: 'assistant', content: rawResponse });
        conversationHistory.push({
          role: 'user',
          content: `[Tool Result: ${toolResult.tool}]\n${toolResult.result}`,
        });
        // Continue the loop
        continue;
      } catch (err) {
        // If tool call parsing fails, treat the response as final
        console.warn('[ReAct] Tool call JSON parsing failed, treating response as final.', err);
      }
    }

    // No tool call — this is the final answer
    // Parse it the same way as the standard sendChatMessage response
    try {
      const parsed = JSON.parse(rawResponse);
      return {
        assistantResponse: parsed.assistantResponse ?? rawResponse,
        suggestedDestinationIds: parsed.suggestedDestinationIds ?? [],
        suggestedPrices: parsed.suggestedPrices ?? {},
        updatedParams: parsed.updatedParams ?? {},
        tourScript: parsed.tourScript ?? [],
      };
    } catch {
      return {
        assistantResponse: rawResponse,
        suggestedDestinationIds: [],
        suggestedPrices: {},
        updatedParams: {},
        tourScript: [],
      };
    }
  }

  // Fallback if max steps reached without a final answer
  return sendChatMessage(message, history, currentParams);
}

// ── GMI Cloud path ───────────────────────────────────────────────────────────

/**
 * Send a chat message via the backend GMI Cloud proxy (/api/gmi/chat).
 * The backend authenticates with the GMI Cloud API using GMI_CLOUD_API_KEY
 * so that key is never exposed in the browser bundle.
 */
async function sendGmiCloudMessage(
  message: string,
  history: ChatMessage[],
  currentParams: TripParams,
  model: string
): Promise<AIResponse> {
  try {
    // Fetch live travel context from Exa (non-blocking — gracefully returns '' on failure)
    const exaContext = await fetchExaTravelContext(message, currentParams);
    const contextPrefix = buildContextPrefix(message, currentParams, exaContext);

    // Build OpenAI-format messages array: system prompt + conversation history + new user message
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history.slice(-12).map((msg) => ({
        role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: msg.content,
      })),
      { role: 'user' as const, content: contextPrefix },
    ];

    const resp = await fetch('/api/gmi/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model }),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(errBody?.error ?? `Backend returned ${resp.status}`);
    }

    const data = (await resp.json()) as { content?: string };
    const raw = (data.content ?? '').trim();
    return parseAIResponse(raw);
  } catch (error) {
    console.error('GMI Cloud error:', error);
    return {
      assistantResponse:
        "The GMI Cloud signal dropped somewhere over the horizon. Check your GMI_CLOUD_API_KEY or try a different model.",
      suggestedDestinationIds: [],
      suggestedPrices: {},
      updatedParams: {},
      tourScript: [],
    };
  }
}
