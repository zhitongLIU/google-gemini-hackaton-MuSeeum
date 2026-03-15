# Deploy MuSeeum on Google Cloud

Deploy the backend (museeum-api) and frontend (museeum-web) to **Cloud Run** from this repository.

**Repository layout:** Run all deploy commands from the directory that contains both `museeum-api/` and `museeum-web/` and the root `cloudbuild.yaml` and `Makefile`. If you use separate git repos for each app, run `make deploy` or `./scripts/deploy.sh` from a parent folder that has both subdirectories. Each project has a `.dockerignore` so Docker builds ignore `.git`, `node_modules`, `.env`, and build output.

## Environment variables

### Backend (museeum-api)

| Where        | What to set | How |
|-------------|-------------|-----|
| **Local dev** | `GEMINI_API_KEY`, optional `PORT` | Copy `museeum-api/.env.example` to `museeum-api/.env` and fill in your key. |
| **Cloud Run (deploy)** | `GEMINI_API_KEY` | **Option A:** Pass when deploying: `GEMINI_API_KEY=your_key make deploy`. The deploy script also reads `museeum-api/.env` if the env var is not set. **Option B (production):** Store the key in Secret Manager (see [One-time setup](#one-time-setup)) and use `--set-secrets=GEMINI_API_KEY=gemini-api-key:latest` in `cloudbuild.yaml` instead of `--set-env-vars` with `_GEMINI_API_KEY`. |

Other backend env vars (e.g. `PORT`) are set by Cloud Run or in the Dockerfile; add more in the backend deploy step’s `--set-env-vars` or `--set-secrets` if needed.

### Frontend backend URL (museeum-web)

The frontend calls the backend using `VITE_API_URL`. It is **baked in at build time** (Vite replaces `import.meta.env.VITE_API_URL` in the bundle).

| Where        | How the backend URL is set |
|-------------|-----------------------------|
| **Local dev** | Set `VITE_API_URL` when starting the dev server, e.g. `VITE_API_URL=http://localhost:3080 npm run dev` (use the port your backend runs on). Copy `museeum-web/.env.example` to `museeum-web/.env` to set it once. |
| **Production (full deploy)** | You don’t set it. Cloud Build deploys the backend first, reads its URL, then builds the frontend with that URL as `VITE_API_URL`. |
| **Frontend-only deploy** | The build must receive the backend URL. Use `make deploy-web` (which uses the script); the script runs Cloud Build, which gets the URL from the already-deployed backend. If you build the frontend image yourself, pass `--build-arg VITE_API_URL=https://museeum-api-xxx.run.app`. |

So: for **backend** you configure env (and optionally secrets) for the Cloud Run service; for **frontend** you configure the backend URL only for local dev or when building the image yourself—on full deploy it’s automatic.

### App ID (restrict API to museeum-web)

To allow only museeum-web to call museeum-api, set a shared **app id** (any secret string):

- **Backend:** Set `MUSEEUM_APP_ID` in Cloud Run (via deploy script: `MUSEEUM_APP_ID=your-secret make deploy`, or add it to `museeum-api/.env` so the script picks it up and passes `_MUSEEUM_APP_ID`). The API will reject HTTP requests without the `X-Museeum-App-Id` header and WebSocket connections without the `appId` query param when this is set.
- **Frontend:** Set `VITE_MUSEEUM_APP_ID` to the same value so the built app sends the header and query param. For deploy, set `MUSEEUM_APP_ID` when running the script (e.g. `MUSEEUM_APP_ID=your-secret make deploy`); the script passes it to Cloud Build for both the backend env and the frontend build arg. For local dev, set `VITE_MUSEEUM_APP_ID` in `museeum-web/.env` (see `museeum-web/.env.example`).

If you do not set an app id, any client can call the API (current behaviour).

### Judge access code (restrict app to judges / organizers)

To allow only people who have the code (e.g. hackathon judges) to use the app:

- **Backend:** Set `JUDGE_ACCESS_CODE` in Cloud Run. When set, the API returns 403 for `POST /api/session` without a valid code and closes WebSocket connections that don’t send the code. Deploy with e.g. `JUDGE_ACCESS_CODE=your-code make deploy`, or add `JUDGE_ACCESS_CODE` to `museeum-api/.env` so the script passes `_JUDGE_ACCESS_CODE`.
- **Frontend:** No build-time config. Users see an “Enter access code” gate; they can type the code or open a magic link with the code in the URL (`?access=your-code`). Give judges the link or the code.

If you do not set a judge code, anyone can use the app.

---

## Prerequisites

- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed and logged in.
- A GCP project: `gcloud config set project YOUR_PROJECT_ID`

## One-time setup

From the **repository root**:

```bash
make setup
```

This enables Cloud Run, Cloud Build, and Artifact Registry, and creates the Artifact Registry repository `museeum` if it does not exist.

**Gemini API key (required for the Live Agent):**

- **Option A (quick):** Pass the key when deploying: `GEMINI_API_KEY=your_key make deploy`
- **Option B (recommended for production):** Store in Secret Manager:
  ```bash
  echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=- --project=YOUR_PROJECT_ID
  ```
  Then grant Cloud Run access to the secret and update `cloudbuild.yaml` to use `--set-secrets=GEMINI_API_KEY=gemini-api-key:latest` in the backend deploy step instead of `_GEMINI_API_KEY`.

## Deploy both (recommended)

From the **repository root**:

```bash
make deploy
# Or with the key inline:
GEMINI_API_KEY=xxx make deploy
```

This runs `./scripts/deploy.sh`, which submits the root `cloudbuild.yaml` to Cloud Build. The build will:

1. Build and deploy the backend to Cloud Run (`museeum-api`).
2. Get the backend URL, then build the frontend with that URL as `VITE_API_URL`.
3. Deploy the frontend to Cloud Run (`museeum-web`).

At the end you will see the **Backend** and **Frontend** URLs. Open the Frontend URL in a browser; it will call and open WebSockets to the Backend URL automatically.

## Deploy only backend or only frontend

- **Backend only:** `make deploy-api` (set `GEMINI_API_KEY` if needed).
- **Frontend only:** `make deploy-web` (backend must already be deployed so the frontend can be built with the correct API URL).

For `make deploy-api` and `make deploy-web`, Docker must be installed and configured for Artifact Registry: `gcloud auth configure-docker REGION-docker.pkg.dev` (e.g. `us-central1-docker.pkg.dev`).

## Other Makefile targets

Run `make help` for a short list. Examples:

- `make build-api` / `make build-web` — Local Docker build only (no push/deploy).
- `make run-api` / `make run-web` — Run backend or frontend locally for development.

## Manual deploy (without Makefile)

```bash
# From repo root
./scripts/deploy.sh

# Or call gcloud directly:
gcloud builds submit --config=cloudbuild.yaml . \
  --substitutions=_REGION=us-central1,_GEMINI_API_KEY=your_key
```

## Variables

You can override defaults when running `make`:

- `REGION` — Default `us-central1`.
- `PROJECT_ID` — Default from `gcloud config get-value project`.
- `AR_REPO` — Artifact Registry repo name, default `museeum`.
- `API_SERVICE` / `WEB_SERVICE` — Cloud Run service names, default `museeum-api` and `museeum-web`.

Example: `make deploy REGION=europe-west1`
