# MuSeeum

MuSeeum is an AI museum companion that turns your phone into a live tour guide.  
Visitors point their camera at artworks and talk to a Gemini Live–powered agent for real‑time descriptions, Q&A, and a personalized tour diary.

- **Backend:** [museeum-api/](museeum-api/) — Node/TS, Express, WebSocket bridge to Gemini Live.
- **Frontend:** [museeum-web/](museeum-web/) — React/TS, Vite, camera UX + push‑to‑talk.

For full product and architecture details, see:
- [prd.md](prd.md) — product requirements and user journeys
- [ARCHITECTURE.md](ARCHITECTURE.md) — high‑level system and agent architecture
- [docs/agent-app-architecture-guide.md](docs/agent-app-architecture-guide.md) — agent app design notes

## for judge testing
use https://museeum-web-7dbzezb27a-od.a.run.app
and code: hackathon2026a3ffc
---

## Repository layout

Run commands from the **repository root** (this directory):

- `museeum-api/` — backend service (HTTP + WebSocket API for Gemini Live)
- `museeum-web/` — frontend SPA
- `cloudbuild.yaml` — Cloud Build config for building & deploying both services to Cloud Run
- `scripts/deploy.sh` — wrapper script for Cloud Build deploy
- `Makefile` — convenience targets for local dev and deploy
- `docs/` — additional documentation:
  - `docs/deploy-gcp.md` — detailed GCP deployment guide
  - `docs/hackaton.md` — hackathon notes
  - `docs/rules.md` — official Gemini Live Agent Challenge rules (reference)

---

## Features

- **Two‑phase artwork identification**
  - Art Info Agent (vision + Google Search grounding) suggests title, artist, museum, and period.
  - Docent Agent generates human‑style descriptions and sections once an artwork is confirmed.
- **Live Agent voice Q&A**
  - Gemini Live WebSocket connection for push‑to‑talk questions about the current artwork or visit.
- **Tour diary**
  - Summarizes your visit into a narrative with sections and lets you **download as HTML**.
- **Hackathon‑optimized data model**
  - No server‑side persistence; all visit/session data is stored in the browser’s `localStorage`.
  - Access control is via **access code** and optional **app id**, not full auth.

---

## Tech stack

- **Backend (`museeum-api`)**
  - Node.js + TypeScript
  - Express HTTP API + WebSocket
  - Google Gemini API (Live + text/vision models) via Google GenAI SDK
  - Deployed to **Cloud Run**
- **Frontend (`museeum-web`)**
  - React + TypeScript
  - Vite, Tailwind, shadcn‑style components
  - Uses `navigator.mediaDevices.getUserMedia` for camera where available
  - Deployed to **Cloud Run**
- **DevOps**
  - Google Cloud Build + Artifact Registry
  - Makefile for local and CI‑style workflows
  - Secrets via Google Secret Manager

---

## Backend: `museeum-api`

### Local setup

```bash
cd museeum-api
npm install
cp .env.example .env
# Set GEMINI_API_KEY in .env
npm run dev
```

By default the API listens on `http://localhost:8080` (or `PORT`).

### Environment variables

| Var                  | Description                                                                                   |
|----------------------|-----------------------------------------------------------------------------------------------|
| `PORT`               | HTTP port (default: `8080`)                                                                   |
| `GEMINI_API_KEY`     | Google AI API key for Gemini (required)                                                      |
| `GEMINI_LIVE_MODEL`  | Live model (default: `gemini-2.5-flash-native-audio-preview-12-2025`)                        |
| `GEMINI_ART_MODEL`   | Text/vision model for Art Info, Docent, summary (default: `gemini-2.5-flash`)                |
| `JUDGE_ACCESS_CODE`  | Optional; when set, required in body/header/query for all API + WS calls                     |
| `MUSEEUM_APP_ID`     | Optional; when set, clients must send `X-Museeum-App-Id` header / `appId` WS query parameter |

### API surface

- `GET /health`  
  Health check → `{ "status": "ok" }`

- `POST /api/session`  
  Body: `{ "accessCode"?: string }`  
  Creates a logical session for Live WebSocket, returns `{ "sessionId": "<uuid>" }`.

- `POST /api/session/:id/artwork`  
  Body: `{ "image": "<base64>", "accessCode"?: string }`  
  Runs the Art Info Agent, returns a tentative candidate with metadata.

- `POST /api/session/:id/artwork/confirm`  
  Body: `{ "title", "artist?", "period?", "year?", "museumName?", "accessCode"?: string }`  
  Runs the Docent Agent and returns a fully described artwork.

- `POST /api/session/:id/summary`  
  Body: `{ "artworks": [{ "title", "artist?", "explanationText?" }], "accessCode"?: string }`  
  Returns a structured tour summary.

- `WS /api/live/:sessionId`  
  WebSocket connection to Gemini Live. Query params: `appId`, `accessCode`.  
  Client sends `{ "type": "audio" | "image" | "text", "data": "..." }`; receives `ready`, `text`, `audio`, `inputTranscript`, `outputTranscript`, `error`.

---

## Frontend: `museeum-web`

### Local setup

```bash
cd museeum-web
npm install
npm run dev
```

Open the dev server URL (e.g. `http://localhost:5173`).

If the backend is not on `http://localhost:8080`, set `VITE_API_URL`:

```bash
VITE_API_URL=http://localhost:3080 npm run dev
```

If the backend enforces an app id:

```bash
VITE_MUSEEUM_APP_ID=your-app-id npm run dev
```

### Usage flow

1. **Access gate**  
   - If the backend sets `JUDGE_ACCESS_CODE`, the app shows an access code gate.
   - Judges can either type the code or use a magic link `?access=CODE`.

2. **Capture or upload artwork**  
   - Use the photo menu to **Take a photo** (camera) or **Upload from gallery**.
   - A backend session is created on first capture and saved in `localStorage`.

3. **Live identification + docent**  
   - Art Info Agent proposes title/artist/museum.
   - User can confirm by voice, typing, or waiting; Docent Agent then creates the narrative.

4. **Browse visit**  
   - Gallery and visit summary screens show all artworks, favorites, and analysis.

5. **Talk to the AI guide**  
   - Push‑to‑talk Live Agent for follow‑up questions.

6. **Download tour diary**  
   - Generate a rich tour story and download as HTML.

All visit data (sessions, artworks, photos, summaries) is stored in the browser’s `localStorage` only.

---

## Running the full stack locally

1. **Start backend**

   ```bash
   cd museeum-api
   npm install
   cp .env.example .env
   # set GEMINI_API_KEY=...
   npm run dev    # listens on http://localhost:8080
   ```

2. **Start frontend**

   ```bash
   cd museeum-web
   npm install
   VITE_API_URL=http://localhost:8080 npm run dev
   ```

3. Open the frontend URL (e.g. `http://localhost:5173`) and follow the usage flow above.

---

## Deploying to Google Cloud (Cloud Run)

Full, up‑to‑date instructions live in [docs/deploy-gcp.md](docs/deploy-gcp.md).  
This section summarizes the key steps required for the hackathon’s **spin‑up / reproducibility** requirement.

### Prerequisites

- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed and authenticated.
- A GCP project:

  ```bash
  gcloud config set project YOUR_PROJECT_ID
  ```

- This repository cloned, with `museeum-api/`, `museeum-web/`, `cloudbuild.yaml`, `Makefile`, and `scripts/deploy.sh` present.

### One‑time GCP setup

From the **repo root**:

```bash
make setup
```

This will:

- Enable Cloud Run, Cloud Build, Artifact Registry.
- Create an Artifact Registry repo named `museeum` (configurable via `AR_REPO`).

Then create required secrets in **Secret Manager** (production):

```bash
# Required: Gemini API key
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=- --project=YOUR_PROJECT_ID

# Optional: restrict API to this frontend only
echo -n "YOUR_MUSEEUM_APP_ID" | gcloud secrets create museeum-app-id --data-file=- --project=YOUR_PROJECT_ID

# Optional: restrict usage to judges/organizers
echo -n "YOUR_JUDGE_ACCESS_CODE" | gcloud secrets create judge-access-code --data-file=- --project=YOUR_PROJECT_ID
```

Cloud Run permissions to read these secrets must be granted; `cloudbuild.yaml` assumes they exist and mounts them into the backend service.

### Recommended: deploy backend + frontend together

From the **repo root**:

```bash
make deploy
# or, to pass key inline if you are not using Secret Manager yet:
GEMINI_API_KEY=your_key make deploy
```

This runs `./scripts/deploy.sh`, which calls Cloud Build with `cloudbuild.yaml`. The pipeline:

1. Builds and deploys **backend** (`museeum-api`) to Cloud Run.
2. Reads the backend Cloud Run URL.
3. Builds the **frontend** image with `VITE_API_URL` set to that URL.
4. Deploys **frontend** (`museeum-web`) to Cloud Run.

At the end, it prints:

- **Backend URL** (Cloud Run endpoint)
- **Frontend URL** (main app URL)

Open the **frontend URL** in a browser to use the app.  
The frontend will automatically talk to the deployed backend and open Live WebSockets.

### Deploying only backend or only frontend

From the **repo root**:

```bash
# Backend only
make deploy-api   # requires GEMINI_API_KEY via Secret or env

# Frontend only (backend must already be deployed)
make deploy-web
```

For `deploy-api` / `deploy-web`, Docker must be configured for Artifact Registry:

```bash
gcloud auth configure-docker REGION-docker.pkg.dev
# e.g.
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Manual Cloud Build invocation (no Makefile)

```bash
# From repo root
./scripts/deploy.sh

# Or directly:
gcloud builds submit --config=cloudbuild.yaml . \
  --substitutions=_REGION=us-central1,_GEMINI_API_KEY=your_key
```

### Configurable variables

You can override Makefile defaults:

- `REGION` — default: `us-central1`
- `PROJECT_ID` — default: `gcloud config get-value project`
- `AR_REPO` — default: `museeum`
- `API_SERVICE` — default: `museeum-api`
- `WEB_SERVICE` — default: `museeum-web`

Example:

```bash
make deploy REGION=europe-west1 PROJECT_ID=my-project
```

---

## Hackathon submission checklist

This project is structured to satisfy the Gemini Live Agent Challenge requirements:

- **Spin‑up instructions**  
  - Local: “Running the full stack locally” section above.  
  - Cloud: “Deploying to Google Cloud (Cloud Run)” and `docs/deploy-gcp.md`.

- **Proof of Google Cloud deployment**  
  - Cloud Run + Cloud Build configs are in `cloudbuild.yaml`, `scripts/deploy.sh`, and `Makefile`.  
  - For screen recordings, show:
    - Cloud Build history & logs for this repo.
    - Cloud Run services `museeum-api` and `museeum-web` running and being invoked.

- **Architecture diagram**  
  - Include or reference the diagram in `ARCHITECTURE.md` (and any image files you add there).  
  - It should clearly show: frontend ↔ backend ↔ Gemini + Google Cloud services.

- **Public repo & documentation**  
  - This `README.md` + `docs/deploy-gcp.md` + `prd.md` + `ARCHITECTURE.md` form the main documentation set.
  - Add links to demo video, blog posts, and any bonus content in `docs/hackaton.md` or here.

---

## Troubleshooting

- **Art Info Agent 404 (model not available)**  
  Set a compatible model in `museeum-api/.env`:

  ```env
  GEMINI_ART_MODEL=gemini-2.5-flash-lite
  ```

  Or another available model from the Gemini docs, then restart the backend.

- **Live Agent closes before ready**  
  1. Ensure Live API is enabled for your key by testing from Google AI Studio.  
  2. Set `GEMINI_API_KEY` in `museeum-api/.env`.  
  3. Optionally set `GEMINI_LIVE_MODEL=gemini-2.0-flash-exp` and restart.

- **403 / access code issues**  
  - Confirm `JUDGE_ACCESS_CODE` is set in Secret Manager or `.env`.  
  - Use the same code in the frontend access screen or `?access=CODE` URL param.

---

## License

TBD – choose an appropriate license (e.g. MIT, Apache‑2.0) before final submission.

