# MuSeeum API

Backend for the MuSeeum MVP: session creation and Gemini Live WebSocket bridge.

## Run locally

```bash
npm install
cp .env.example .env
# Set GEMINI_API_KEY in .env (required for Live Agent)
npm run dev
```

Server listens on `http://localhost:8080` (or `PORT` from env).

## Fix: "Live Agent connection closed before ready"

If the app shows this error, do the following:

1. **Get a Gemini API key**
   - Open [Google AI Studio → API keys](https://aistudio.google.com/app/apikey).
   - Sign in with your Google account.
   - Click **Create API key** (create a project if prompted).
   - Copy the key.

2. **Enable Live API access**
   - Try the Live API once in the browser: [Google AI Studio → Live](https://aistudio.google.com/live). That helps ensure your account can use the Live API.
   - The same API key from step 1 is used for the WebSocket Live API.

3. **Configure the backend**
   - In `museeum-api/.env` set:
     ```env
     GEMINI_API_KEY=your_pasted_key_here
     ```
   - Restart the API (`npm run dev` in `museeum-api`).

4. **If it still fails**
   - Confirm the key has no extra spaces or quotes in `.env`.
   - **Watch the backend terminal** when you connect from the app. You should see `[Gemini Live] Connected, sending setup...` then either `[Gemini Live] setupComplete received` or `[Gemini Live] Error from API:` / `[Gemini Live] Closed: <code> <reason>`. The reason/code is the actual error from Google.
   - Try a different Live model by adding to `.env`:
     ```env
     GEMINI_LIVE_MODEL=gemini-2.0-flash-exp
     ```
     Then restart the API. Some keys or regions may not have `gemini-2.5-flash-native-audio-preview-12-2025`.
   - Use a key from [aistudio.google.com](https://aistudio.google.com/app/apikey) (not a Vertex AI–only key).

## Env vars

| Var | Description |
|-----|-------------|
| `PORT` | HTTP port (default: 8080) |
| `GEMINI_API_KEY` | Google AI API key for Gemini Live (required for `/api/live`) |

## Endpoints

- **GET /health** — `{ "status": "ok" }`
- **POST /api/session** — body optional; returns `{ "sessionId": "<uuid>" }`
- **WS /api/live/:sessionId** — WebSocket to the Live Agent. Send JSON:
  - `{ "type": "audio", "data": "<base64>" }` — audio (PCM 16 kHz 16-bit LE preferred)
  - `{ "type": "image", "data": "<base64>" }` — image for “describe this”
  - `{ "type": "text", "data": "..." }` — text input  
  Receive: `{ "type": "ready" }`, `{ "type": "text", "data": "..." }`, `{ "type": "audio", "data": "..." }`, `{ "type": "inputTranscript", "data": "..." }`

## With frontend

Run the frontend with `VITE_API_URL=http://localhost:8080` (or your API base URL).

## Deploy to Cloud Run

From the **repository root** (parent of `museeum-api`):

- **One-command deploy (backend + frontend):** `make deploy` or `./scripts/deploy.sh`. Set `GEMINI_API_KEY=xxx` or ensure Secret Manager secret `gemini-api-key` exists; see [docs/deploy-gcp.md](../docs/deploy-gcp.md).
- **Backend only:** Build and push the image, then deploy:
  ```bash
  docker build -t us-central1-docker.pkg.dev/PROJECT_ID/museeum/museeum-api:latest ./museeum-api
  docker push us-central1-docker.pkg.dev/PROJECT_ID/museeum/museeum-api:latest
  gcloud run deploy museeum-api --image us-central1-docker.pkg.dev/PROJECT_ID/museeum/museeum-api:latest \
    --region us-central1 --allow-unauthenticated \
    --set-env-vars "GEMINI_API_KEY=xxx"
  ```
  Or use `make deploy-api` (set `PROJECT_ID` and optionally `GEMINI_API_KEY`).
