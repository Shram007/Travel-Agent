/**
 * backend/src/index.ts
 * Entry point for the Wandr backend server.
 * Serves as the integration hub for Exa search and GMI Cloud LLM inference.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { searchTravelContext } from './exa/exaService.js';
import { callGmiChat, GMI_MODELS } from './gmi/gmiService.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Rate limiting — 30 requests per minute per IP for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'wandr-backend',
    exa: !!process.env.EXA_API_KEY && process.env.EXA_API_KEY !== 'MY_EXA_API_KEY',
    gmi: !!process.env.GMI_CLOUD_API_KEY && process.env.GMI_CLOUD_API_KEY !== 'YOUR_GMI_CLOUD_API_KEY',
  });
});

// GMI Cloud available models — single source of truth for the frontend
app.get('/api/gmi/models', (_req, res) => {
  res.json({ models: GMI_MODELS });
});

// Exa context route for grounding itinerary/chat responses
app.post('/api/exa/context', aiLimiter, async (req, res) => {
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

// GMI Cloud chat route — authenticated proxy to https://api.gmi-serving.com/v1
// The frontend builds the full OpenAI-format messages array and sends it here
// so the GMI_CLOUD_API_KEY is never exposed to the browser.
app.post('/api/gmi/chat', aiLimiter, async (req, res) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
    if (!model) {
      return res.status(400).json({ error: 'model is required' });
    }

    if (!(GMI_MODELS as readonly string[]).includes(model)) {
      return res
        .status(400)
        .json({ error: `Unsupported model "${model}". Available: ${GMI_MODELS.join(', ')}` });
    }

    const result = await callGmiChat({ messages, model });
    return res.json(result);
  } catch (error) {
    console.error('GMI Cloud chat route error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `GMI Cloud request failed: ${message}` });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Wandr backend running on http://localhost:${PORT}`);
  console.log(`   Exa API key:       ${process.env.EXA_API_KEY ? '✅ loaded' : '❌ missing (add to backend/.env)'}`);
  console.log(`   GMI Cloud API key: ${process.env.GMI_CLOUD_API_KEY ? '✅ loaded' : '⚠️ missing (optional — needed for GMI Cloud models)'}`);
});

export default app;
