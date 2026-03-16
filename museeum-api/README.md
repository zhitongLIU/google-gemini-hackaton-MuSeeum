# MuSeeum API

Backend for MuSeeum: session creation, Art Info Agent (vision + grounding), Docent Agent (description), optional summary generation, and Gemini Live WebSocket bridge.

**Hackathon setup:** No server-side persistence. Sessions are in-memory for Live WebSocket; all visit data (sessions, artworks, summaries) is stored in the **frontend’s localStorage**. Access control is **access code only** (no login).

## Run locally

```bash
npm install
cp .env.example .env
# Set GEMINI_API_KEY in .env (required for Live and agents)
npm run dev
```

Server listens on `http://localhost:8080` (or `PORT` from env).

## Env vars

| Var | Description |
|-----|-------------|
| `PORT` | HTTP port (default: 8080) |
| `GEMINI_API_KEY` | Google AI API key for Gemini (required for Live and Art Info/Docent/summary) |
| `GEMINI_LIVE_MODEL` | Optional; Live model (default: gemini-2.5-flash-native-audio-preview-12-2025) |
| `GEMINI_ART_MODEL` | Optional; model for Art Info/Docent/summary (default: gemini-2.5-flash) |
| `JUDGE_ACCESS_CODE` | Optional; when set, required in body or header for session, artwork, summary, and WS |
| `MUSEEUM_APP_ID` | Optional; when set, clients must send `X-Museeum-App-Id` header |

## Endpoints

- **GET /health** — `{ "status": "ok" }`
- **POST /api/session** — body `{ "accessCode"?: string }`; returns `{ "sessionId": "<uuid>" }`. Used for Live WebSocket; frontend stores session in localStorage.
- **POST /api/session/:id/artwork** — body `{ "image": "<base64>", "accessCode"?: string }`. Art Info Agent (Gemini + Google Search grounding) returns `{ "tempId", "candidate": { "title", "artist", "museum?", "year?", "period", "confidence" } }`. Stateless.
- **POST /api/session/:id/artwork/confirm** — body `{ "title", "artist?", "period?", "year?", "museumName?", "accessCode"?: string }`. Docent Agent returns `{ "artworkId", "title", "artist", "explanationText", "sections?", "tags?" }`. Stateless.
- **POST /api/session/:id/summary** — body `{ "artworks": [{ "title", "artist?", "explanationText?" }], "accessCode"?: string }`. Returns `{ "summaryText", "sections" }`. Stateless.
- **WS /api/live/:sessionId** — WebSocket to Gemini Live. Query: `appId`, `accessCode`. Send JSON: `{ "type": "audio"|"image"|"text", "data": "..." }`. Receive: `ready`, `text`, `audio`, `inputTranscript`, `outputTranscript`, `error`.

## Fix: "Art Info Agent failed: 404 ... model no longer available"

The default model for Art Info/Docent/summary is `gemini-2.5-flash`. If you get a 404 (model not available for your key or region), set a different model in `.env`:

```env
GEMINI_ART_MODEL=gemini-2.5-flash-lite
```

Or try `gemini-2.5-pro` / another [available model](https://ai.google.dev/gemini-api/docs/models). Restart the API after changing.

## Fix: "Live Agent connection closed before ready"

1. Get a Gemini API key from [Google AI Studio → API keys](https://aistudio.google.com/app/apikey).
2. Enable Live API: try [Google AI Studio → Live](https://aistudio.google.com/live) in the browser.
3. Set `GEMINI_API_KEY=your_key` in `museeum-api/.env` and restart.
4. If it still fails, try `GEMINI_LIVE_MODEL=gemini-2.0-flash-exp` in `.env` and restart.

## With frontend

Run the frontend with `VITE_API_URL=http://localhost:8080` (or your API base URL).

## Deploy to Cloud Run

From the repository root:

- **One-command deploy:** `make deploy` or `./scripts/deploy.sh`. See [docs/deploy-gcp.md](../docs/deploy-gcp.md).
- **Backend only:** `make deploy-api` (set `PROJECT_ID` and optionally `GEMINI_API_KEY`).
