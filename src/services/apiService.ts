export interface Recommendation {
  city: string;
  country: string;
  description: string;
}

export interface ChatSuggestionResult {
  recommendations: Recommendation[];
  followUpQuestion: string;
  rawResponse: string;
}

export interface SourceLink {
  title: string;
  url: string;
}

export interface DestinationSection {
  city: string;
  highlights: string[];
  sources: SourceLink[];
}

export interface DestinationDetailsResult {
  activities: DestinationSection;
  hotels: DestinationSection;
  flights: DestinationSection;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message = errorPayload?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function fetchChatSuggestions(prompt: string): Promise<ChatSuggestionResult> {
  return postJson<ChatSuggestionResult>('/api/chat', { prompt });
}

export function fetchDestinationDetails(
  city: string,
  country: string,
  origin?: string
): Promise<DestinationDetailsResult> {
  return postJson<DestinationDetailsResult>('/api/destination', {
    city,
    country,
    origin,
  });
}
