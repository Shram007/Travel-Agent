/**
 * backend/src/index.ts
 * Entry point for the Wandr backend server.
 * Serves as the integration hub for Exa search and future backend capabilities.
 */

import 'dotenv/config';
import express from 'express';
import { searchTravelContext } from './exa/exaService.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'wandr-backend',
    exa: !!process.env.EXA_API_KEY && process.env.EXA_API_KEY !== 'MY_EXA_API_KEY',
  });
});

// Exa context route for grounding itinerary/chat responses
app.post('/api/exa/context', async (req, res) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const numResults =
      typeof req.body?.numResults === 'number' && Number.isFinite(req.body.numResults)
        ? Math.max(1, Math.min(10, Math.floor(req.body.numResults)))
        : 6;

    const maxHighlightChars =
      typeof req.body?.maxHighlightChars === 'number' &&
      Number.isFinite(req.body.maxHighlightChars)
        ? Math.max(120, Math.min(2000, Math.floor(req.body.maxHighlightChars)))
        : 500;

    const result = await searchTravelContext(query, { numResults, maxHighlightChars });
    return res.json(result);
  } catch (error) {
    console.error('Exa context route error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Exa travel context' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Wandr backend running on http://localhost:${PORT}`);
  console.log(`   Exa API key: ${process.env.EXA_API_KEY ? '✅ loaded' : '❌ missing (add to backend/.env)'}`);
});

export default app;
