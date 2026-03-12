/**
 * gmiService.ts
 * GMI Cloud LLM proxy for Atlas travel assistant.
 *
 * GMI Cloud provides an OpenAI-compatible inference API at:
 *   https://api.gmi-serving.com/v1
 *
 * The frontend prepares the full OpenAI-format messages array (including the
 * system prompt with the destination index) and sends it here.  This service
 * acts as an authenticated proxy so the GMI Cloud API key is never exposed to
 * the browser.
 *
 * Obtain an API key at: https://app.gmi-serving.com/api-keys
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GmiChatRequest {
  /** OpenAI-format messages array (built by the frontend). */
  messages: OpenAIMessage[];
  /** GMI Cloud model identifier, e.g. "deepseek-ai/DeepSeek-R1". */
  model: string;
}

export interface GmiChatResponse {
  /** Raw JSON string returned by the model — parsed by the frontend. */
  content: string;
}

/** Models available through GMI Cloud — exported for frontend model list. */
export const GMI_MODELS = [
  'deepseek-ai/DeepSeek-R1',
  'meta-llama/Meta-Llama-3.3-70B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct',
] as const;

export type GmiModel = (typeof GMI_MODELS)[number];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.GMI_CLOUD_API_KEY;
  if (!key || key === 'YOUR_GMI_CLOUD_API_KEY') {
    throw new Error(
      'GMI_CLOUD_API_KEY is not set. Add it to your .env file. ' +
        'Get a key at https://app.gmi-serving.com/api-keys'
    );
  }
  return key;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Forward a chat completion request to GMI Cloud and return the raw model
 * content string so the frontend can apply its usual JSON parsing logic.
 */
export async function callGmiChat(req: GmiChatRequest): Promise<GmiChatResponse> {
  const apiKey = getApiKey();

  const body = JSON.stringify({
    model: req.model,
    messages: req.messages,
    temperature: 0.8,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let resp: Response;
  try {
    resp = await fetch('https://api.gmi-serving.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    throw new Error(`GMI Cloud API error ${resp.status}: ${errText}`);
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  return { content };
}
