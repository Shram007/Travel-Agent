/**
 * explore.mjs — Live Exa API exploration for travel destinations.
 * Run: node backend/explore.mjs
 */

import Exa from 'exa-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root manually (no dotenv dep needed for a quick script)
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env');
try {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.replace(/\r/, '').split('=');
    if (k && !k.startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch { /* .env not found, rely on process env */ }

const EXA_API_KEY = process.env.EXA_API_KEY;
if (!EXA_API_KEY || EXA_API_KEY === 'MY_EXA_API_KEY') {
  console.error('❌  EXA_API_KEY not set in .env');
  process.exit(1);
}

const exa = new Exa(EXA_API_KEY);

function divider(label) {
  console.log('\n' + '─'.repeat(60));
  console.log(`  ${label}`);
  console.log('─'.repeat(60));
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  🌍  Exa API — Live Travel Exploration');
  console.log('═'.repeat(60));

  // ── Query 1: Best places in the world ──────────────────────────
  divider('Query 1 · "best places to visit in the world 2025"  [auto]');

  const q1 = await exa.search(
    'best places to visit in the world 2025 travel bucket list',
    {
      type: 'auto',
      numResults: 5,
      contents: {
        highlights: { numSentences: 3, highlightsPerResult: 2 },
        text: { maxCharacters: 300 },
      },
    }
  );

  console.log(`\n  ✅ ${q1.results.length} results\n`);

  // Show full structure of first result
  const r0 = q1.results[0];
  console.log('  ── Full structure of result[0] ──');
  console.log(JSON.stringify({
    title:         r0.title,
    url:           r0.url,
    publishedDate: r0.publishedDate,
    author:        r0.author ?? null,
    score:         r0.score,
    highlights:    r0.highlights,
    text_preview:  r0.text?.slice(0, 200) + (r0.text?.length > 200 ? '…' : ''),
  }, null, 2));

  console.log('\n  ── All 5 results (title + top highlight) ──');
  q1.results.forEach((r, i) => {
    console.log(`\n  [${i + 1}] ${r.title}`);
    console.log(`      🔗 ${r.url}`);
    if (r.highlights?.[0]) console.log(`      💬 "${r.highlights[0].slice(0, 130)}…"`);
  });

  // ── Query 2: Tokyo deep-dive (neural) ─────────────────────────
  divider('Query 2 · Tokyo travel tips  [neural]');

  const q2 = await exa.search(
    'things to do in Tokyo Japan hidden gems local food tips 2025',
    {
      type: 'neural',
      numResults: 3,
      contents: { highlights: { numSentences: 4, highlightsPerResult: 3 } },
    }
  );

  console.log(`\n  ✅ ${q2.results.length} results\n`);
  q2.results.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.title}  (score: ${r.score?.toFixed(3)})`);
    console.log(`      🔗 ${r.url}`);
    (r.highlights ?? []).forEach((h, j) =>
      console.log(`      [h${j + 1}] ${h.slice(0, 160)}`)
    );
    console.log();
  });

  // ── Query 3: Budget trips from SFO ────────────────────────────
  divider('Query 3 · Cheap flights from San Francisco summer  [auto]');

  const q3 = await exa.search(
    'cheap travel destinations from San Francisco summer 2025 budget under $500',
    {
      type: 'auto',
      numResults: 4,
      contents: { highlights: { numSentences: 2, highlightsPerResult: 2 } },
    }
  );

  console.log(`\n  ✅ ${q3.results.length} results\n`);
  q3.results.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.title}  (score: ${r.score?.toFixed(3)})`);
    if (r.highlights?.[0]) console.log(`      💬 ${r.highlights[0].slice(0, 160)}`);
    console.log();
  });

  // ── Summary ───────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('  KEY FIELDS ON EACH RESULT OBJECT:');
  console.log('    result.title          page/article title');
  console.log('    result.url            source URL');
  console.log('    result.publishedDate  ISO date string');
  console.log('    result.score          Exa relevance score (higher = better)');
  console.log('    result.highlights[]   LLM-ready extracted passages');
  console.log('    result.text           full page text (when requested)');
  console.log('    result.author         author name (if available)');
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('❌  Exa error:', err.message ?? err);
  process.exit(1);
});
