> ✅ Repo verified: Hackathon_7March — pushed from version1.1 branch

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the required API keys in `.env`:
   - `GEMINI_API_KEY`: For Google Gemini AI.
   - `EXA_API_KEY`: For Exa search grounding.
   - `GMI_CLOUD_API_KEY`: (Optional) for GMI Cloud models.
3. Run the app (Frontend + Backend):
   `npm run dev`

The app will be available at `http://localhost:3000`. The backend runs on `localhost:8080` (proxied via `/api`).

## Vercel Deployment

This project is optimized for deployment on [Vercel](https://vercel.com). It uses **Vercel Serverless Functions** for the backend logic.

### Deployment Steps

1. **Connect to Vercel**: Push your code to GitHub/GitLab/Bitbucket and import it as a New Project on Vercel.
2. **Environment Variables**: Add the following secrets in the Vercel Dashboard:
   - `GEMINI_API_KEY`
   - `EXA_API_KEY`
   - `GMI_CLOUD_API_KEY` (if using GMI models)
3. **Build Settings**: Vercel should automatically detect Vite. Use the default settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Deploy**: Vercel will build the frontend and automatically set up the serverless functions in the `api/` directory.

### Project Structure (Vercel-aligned)

- `src/`: React frontend (Vite).
- `api/`: Serverless functions (Express) handling `/api/*` routes.
- `vercel.json`: Routing and configuration.
- `package.json`: Unified dependencies and scripts.

## GMI Cloud Integration

Atlas supports [GMI Cloud](https://www.gmicloud.ai/) as an alternative LLM provider alongside Google Gemini.
GMI Cloud offers an OpenAI-compatible inference API with models such as **DeepSeek-R1**, **Llama 3.3 70B**, and **Qwen 2.5 72B**.

### How it works

```
Browser  →  POST /api/gmi/chat  →  Express backend  →  https://api.gmi-serving.com/v1
```

The `GMI_CLOUD_API_KEY` is kept on the backend so it is never exposed in the browser bundle.

### Setup

1. Obtain a GMI Cloud API key at <https://app.gmi-serving.com/api-keys>

2. Add it to your root `.env` file or Vercel environment variables:

   ```bash
   GMI_CLOUD_API_KEY=your_key_here
   ```

3. GMI Cloud logic is now integrated into the `api/` serverless functions. Local development automatically starts the server.

4. In the Atlas chat UI, open the model selector and choose any **GMI Cloud** model:
   - `deepseek-ai/DeepSeek-R1`
   - `meta-llama/Meta-Llama-3.3-70B-Instruct`
   - `Qwen/Qwen2.5-72B-Instruct`

### Available API endpoint

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/gmi/chat` | Proxies a chat completion request to GMI Cloud |

**Request body:**
```json
{
  "model": "deepseek-ai/DeepSeek-R1",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user",   "content": "Suggest beach destinations under $2000" }
  ]
}
```

**Response:**
```json
{ "content": "{ ... atlas JSON response ... }" }
```
