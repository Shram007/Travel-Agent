/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Landmark, Region, Source, Confidence } from '../data/landmarks';

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

const BATCH_SIZE = 50;
const MIN_THRESHOLD = 10;

const GET_SPARQL_QUERY = () => `
SELECT DISTINCT ?item ?itemLabel ?coords ?inception ?architectLabel ?description ?unescoId ?countryLabel WHERE {
  ?item wdt:P31 wd:Q41176. # building
  ?item wdt:P625 ?coords.
  ?item wdt:P571 ?inception.
  ?item wdt:P17 ?country.
  
  # Filter for construction year between 1200 and 1950
  FILTER(YEAR(?inception) >= 1200 && YEAR(?inception) <= 1950)
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  OPTIONAL { ?item wdt:P84 ?architect. }
  OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
  OPTIONAL { ?item wdt:P757 ?unescoId. }
}
ORDER BY RAND()
LIMIT ${BATCH_SIZE}
`;

function parseWikidataDate(dateStr: string): number {
  const match = dateStr.match(/([+-]?\d{1,4})/);
  return match ? parseInt(match[1]) : 2026;
}

function mapCountryToRegion(country: string): Region {
  const europe = ['Italy', 'France', 'Spain', 'Germany', 'UK', 'United Kingdom', 'Greece', 'Netherlands', 'Belgium', 'Portugal', 'Austria', 'Switzerland', 'Norway', 'Sweden', 'Denmark', 'Finland', 'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Slovenia', 'Slovakia', 'Estonia', 'Latvia', 'Lithuania', 'Ireland', 'Iceland', 'Malta', 'Cyprus', 'Russia', 'Ukraine', 'Belarus', 'Moldova', 'Serbia', 'Bosnia and Herzegovina', 'Montenegro', 'Albania', 'North Macedonia', 'Vatican City', 'San Marino', 'Monaco', 'Andorra', 'Liechtenstein'];
  const mena = ['Turkey', 'Iran', 'Iraq', 'Saudi Arabia', 'UAE', 'United Arab Emirates', 'Israel', 'Jordan', 'Lebanon', 'Syria', 'Yemen', 'Oman', 'Kuwait', 'Qatar', 'Bahrain', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Palestine'];
  const africa = ['Egypt', 'Sudan', 'South Africa', 'Nigeria', 'Kenya', 'Ethiopia', 'Ghana', 'Mali', 'Zimbabwe', 'Tanzania', 'Uganda', 'Senegal', 'Angola', 'Mozambique', 'Namibia', 'Botswana', 'Zambia', 'Rwanda', 'Burundi', 'Somalia', 'Djibouti', 'Eritrea', 'Madagascar', 'Mauritius', 'Seychelles', 'Comoros', 'Cape Verde', 'Mauritania', 'Gambia', 'Guinea', 'Sierra Leone', 'Liberia', 'Ivory Coast', 'Burkina Faso', 'Togo', 'Benin', 'Niger', 'Chad', 'Cameroon', 'Central African Republic', 'Gabon', 'Congo', 'DRC', 'Equatorial Guinea', 'Sao Tome'];
  const southAsia = ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Maldives', 'Afghanistan'];
  const eastAsia = ['China', 'Japan', 'South Korea', 'North Korea', 'Mongolia', 'Taiwan', 'Vietnam', 'Thailand', 'Cambodia', 'Laos', 'Myanmar', 'Burma', 'Malaysia', 'Singapore', 'Indonesia', 'Philippines', 'Brunei', 'Timor-Leste'];
  const americas = ['USA', 'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname', 'Panama', 'Costa Rica', 'Nicaragua', 'Honduras', 'El Salvador', 'Guatemala', 'Belize', 'Cuba', 'Jamaica', 'Haiti', 'Dominican Republic', 'Puerto Rico', 'Trinidad and Tobago', 'Barbados', 'Bahamas'];
  const oceania = ['Australia', 'New Zealand', 'Fiji', 'Papua New Guinea', 'Solomon Islands', 'Vanuatu', 'Samoa', 'Tonga', 'Kiribati', 'Tuvalu', 'Nauru', 'Palau', 'Marshall Islands', 'Micronesia'];

  if (europe.some(c => country.includes(c))) return 'Europe';
  if (mena.some(c => country.includes(c))) return 'MENA';
  if (africa.some(c => country.includes(c))) return 'Africa';
  if (southAsia.some(c => country.includes(c))) return 'South Asia';
  if (eastAsia.some(c => country.includes(c))) return 'East Asia';
  if (americas.some(c => country.includes(c))) return 'Americas';
  if (oceania.some(c => country.includes(c))) return 'Oceania';
  
  return 'Europe';
}

function normalizeCountryName(name: string): string {
  const mapping: Record<string, string> = {
    'United States of America': 'United States',
    'USA': 'United States',
    'UK': 'United Kingdom',
    'Great Britain': 'United Kingdom',
    'Russian Federation': 'Russia',
    'People\'s Republic of China': 'China',
    'Republic of Korea': 'South Korea',
    'Democratic People\'s Republic of Korea': 'North Korea',
    'United Arab Emirates': 'United Arab Emirates',
    'Kingdom of Saudi Arabia': 'Saudi Arabia',
    'Federal Republic of Germany': 'Germany',
    'French Republic': 'France',
    'Kingdom of Spain': 'Spain',
    'Italian Republic': 'Italy',
    'Kingdom of the Netherlands': 'Netherlands',
    'Kingdom of Belgium': 'Belgium',
    'Kingdom of Sweden': 'Sweden',
    'Kingdom of Norway': 'Norway',
    'Kingdom of Denmark': 'Denmark',
    'Republic of India': 'India',
    'Federative Republic of Brazil': 'Brazil',
    'United Mexican States': 'Mexico',
    'Commonwealth of Australia': 'Australia',
    'Canada': 'Canada'
  };

  for (const [long, short] of Object.entries(mapping)) {
    if (name.includes(long) || name === long) return short;
  }
  return name;
}

export async function fetchArchitecturalLandmarks(): Promise<Landmark[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased to 30 second timeout for slow SPARQL endpoints

  try {
    const query = GET_SPARQL_QUERY();
    const response = await fetch(`${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'ArchivalAtlasMuseum/1.0 (https://ais-dev.run.app)'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Wikidata SPARQL endpoint returned status ${response.status}`);
    }

    const data = await response.json();
    const results = data.results.bindings;

    const landmarkMap = new Map<string, Landmark>();

    results.forEach((item: any) => {
      const wikidataId = item.item.value.split('/').pop();
      const isUnesco = !!item.unescoId;
      const id = isUnesco ? `unesco-${wikidataId}` : `wikidata-${wikidataId}`;
      
      if (landmarkMap.has(id)) return;

      const coordsMatch = item.coords.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
      const longitude = coordsMatch ? parseFloat(coordsMatch[1]) : 0;
      const latitude = coordsMatch ? parseFloat(coordsMatch[2]) : 0;
      const year = parseWikidataDate(item.inception.value);
      const country = normalizeCountryName(item.countryLabel.value);
      const region = mapCountryToRegion(country);

      landmarkMap.set(id, {
        id,
        name: item.itemLabel.value,
        latitude,
        longitude,
        construction_year_start: year,
        construction_year_end: year + 5,
        era_label: "Historical",
        region,
        country,
        architectural_type: "Monument",
        source: isUnesco ? 'UNESCO' : 'Wikidata',
        confidence_score: isUnesco ? 'high' : 'medium',
        description: item.description?.value || `A significant architectural landmark in ${country}.`,
        architect: item.architectLabel?.value || 'Unknown'
      });
    });

    const landmarks = Array.from(landmarkMap.values());

    if (landmarks.length < MIN_THRESHOLD) {
      throw new Error(`Insufficient data retrieved (${landmarks.length} entries). Source: Wikidata/UNESCO SPARQL failed to meet the minimum archive threshold of ${MIN_THRESHOLD} landmarks.`);
    }

    return landmarks;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isAbortError = error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('AbortError');
    
    if (isAbortError) {
      console.warn('Archive synchronization timed out or was aborted. Falling back to local records.');
      throw new Error('The global architectural archive is responding slowly. Using local museum records instead.');
    }
    console.error(`Fetch failed:`, error);
    throw new Error(error.message || `Insufficient data retrieved. Source: Wikidata/UNESCO SPARQL failed to provide enough verified landmarks.`);
  }
}
