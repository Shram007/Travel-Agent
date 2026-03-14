/**
 * exaService.ts
 * Exa-powered search functions for travel destination data.
 *
 * Provides real-time travel intelligence — things to do, hotel picks,
 * flight info, local tips — grounded in live web content via Exa's
 * neural search API.
 *
 * Usage:
 *   import { searchDestinationInfo } from './exa/exaService.js';
 *   const info = await searchDestinationInfo('Tokyo', 'Japan');
 */

import Exa from 'exa-js';

// ── Client initialisation ───────────────────────────────────────────────────

function getExaClient(): Exa {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey || apiKey === 'MY_EXA_API_KEY') {
    throw new Error(
      'EXA_API_KEY is not set. Add it to your .env file. ' +
      'Get a key at https://dashboard.exa.ai/api-keys'
    );
  }
  return new Exa(apiKey);
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface DestinationSearchResult {
  city: string;
  country: string;
  /** Raw highlights from Exa — ready to feed to an LLM or display directly */
  highlights: string[];
  /** Source URLs for attribution */
  sources: { title: string; url: string }[];
}

export interface TravelSearchOptions {
  /** Max number of web results to retrieve (default: 5) */
  numResults?: number;
  /** Max characters per highlight snippet (default: 512) */
  maxHighlightChars?: number;
}

// ── Core search helpers ─────────────────────────────────────────────────────

/**
 * Search Exa for travel information about a destination.
 * Returns structured highlights suitable for LLM context or direct display.
 */
export async function searchDestinationInfo(
  city: string,
  country: string,
  options: TravelSearchOptions = {}
): Promise<DestinationSearchResult> {
  const exa = getExaClient();
  const { numResults = 5, maxHighlightChars = 512 } = options;

  const query = `Best things to do in ${city}, ${country} — travel guide highlights activities food`;

  const result: any = await (exa as any).search(query, {
    type: 'auto',          // let Exa decide neural vs keyword
    numResults,
    contents: {
      highlights: {
        numSentences: 4,
        highlightsPerResult: 2,
        maxCharacters: maxHighlightChars,
      },
    },
  });

  const highlights: string[] = [];
  const sources: { title: string; url: string }[] = [];

  for (const r of result.results) {
    if (r.highlights) highlights.push(...r.highlights);
    sources.push({ title: r.title ?? city, url: r.url });
  }

  return { city, country, highlights, sources };
}

/**
 * Search for hotel recommendations in a city.
 */
export async function searchHotels(
  city: string,
  country: string,
  options: TravelSearchOptions = {}
): Promise<DestinationSearchResult> {
  const exa = getExaClient();
  const { numResults = 5, maxHighlightChars = 400 } = options;

  const query = `Best hotels to stay in ${city}, ${country} — top-rated accommodation recommendations`;

  const result: any = await (exa as any).search(query, {
    type: 'auto',
    numResults,
    contents: {
      highlights: {
        numSentences: 3,
        highlightsPerResult: 2,
        maxCharacters: maxHighlightChars,
      },
    },
  });

  const highlights: string[] = [];
  const sources: { title: string; url: string }[] = [];

  for (const r of result.results) {
    if (r.highlights) highlights.push(...r.highlights);
    sources.push({ title: r.title ?? `Hotels in ${city}`, url: r.url });
  }

  return { city, country, highlights, sources };
}

/**
 * Search for flight info and travel tips from an origin to a destination.
 */
export async function searchFlightInfo(
  origin: string,
  destination: string,
  country: string,
  options: TravelSearchOptions = {}
): Promise<DestinationSearchResult> {
  const exa = getExaClient();
  const { numResults = 4, maxHighlightChars = 400 } = options;

  const query = `Flights from ${origin} to ${destination} ${country} — best airlines prices travel tips`;

  const result: any = await (exa as any).search(query, {
    type: 'auto',
    numResults,
    contents: {
      highlights: {
        numSentences: 3,
        highlightsPerResult: 2,
        maxCharacters: maxHighlightChars,
      },
    },
  });

  const highlights: string[] = [];
  const sources: { title: string; url: string }[] = [];

  for (const r of result.results) {
    if (r.highlights) highlights.push(...r.highlights);
    sources.push({ title: r.title ?? `${origin} to ${destination}`, url: r.url });
  }

  return { city: destination, country, highlights, sources };
}

/**
 * Convenience: run all three searches in parallel for a full destination brief.
 */
export async function searchFullDestinationBrief(
  city: string,
  country: string,
  origin: string = 'San Francisco',
  options: TravelSearchOptions = {}
): Promise<{
  activities: DestinationSearchResult;
  hotels: DestinationSearchResult;
  flights: DestinationSearchResult;
}> {
  const [activities, hotels, flights] = await Promise.all([
    searchDestinationInfo(city, country, options),
    searchHotels(city, country, options),
    searchFlightInfo(origin, city, country, options),
  ]);

  return { activities, hotels, flights };
}

export interface ExaContextResult {
  highlights: string[];
  sources: { title: string; url: string }[];
}

/**
 * Generic travel context search used to ground itinerary/chat responses
 * with up-to-date web information (flights, logistics, seasonal notes, etc.).
 */
export async function searchTravelContext(
  query: string,
  options: TravelSearchOptions = {}
): Promise<ExaContextResult> {
  const exa = getExaClient();
  const { numResults = 6, maxHighlightChars = 500 } = options;

  const result: any = await (exa as any).search(query, {
    type: 'auto',
    numResults,
    contents: {
      highlights: {
        numSentences: 3,
        highlightsPerResult: 2,
        maxCharacters: maxHighlightChars,
      },
    },
  });

  const highlights: string[] = [];
  const sources: { title: string; url: string }[] = [];

  for (const r of result.results) {
    if (r.highlights) highlights.push(...r.highlights);
    sources.push({ title: r.title ?? 'Travel source', url: r.url });
  }

  return { highlights, sources };
}
