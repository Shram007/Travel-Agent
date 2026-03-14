/**
 * api/exa/test.ts — Smoke test for Exa initialization.
 */

import 'dotenv/config';
import { searchDestinationInfo } from './exaService.js';

async function main() {
  console.log('🔍 Testing Exa initialization...\n');

  try {
    const result = await searchDestinationInfo('Tokyo', 'Japan', {
      numResults: 3,
      maxHighlightChars: 200,
    });

    console.log(`✅ Exa client initialized successfully.`);
    console.log(`📍 City: ${result.city}, ${result.country}`);
    console.log(`🔗 Sources found: ${result.sources.length}`);
    console.log(`💬 Highlights:\n`);
    result.highlights.slice(0, 3).forEach((h, i) => {
      console.log(`  [${i + 1}] ${h}\n`);
    });
  } catch (err: any) {
    if (err.message?.includes('EXA_API_KEY')) {
      console.error('❌ Missing EXA_API_KEY.');
      console.error('   Add it to your .env: EXA_API_KEY=your-key-here');
      console.error('   Get a key at: https://dashboard.exa.ai/api-keys');
    } else {
      console.error('❌ Exa search failed:', err.message);
    }
    process.exit(1);
  }
}

main();
