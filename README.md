# MuSeeum

AI museum companion: mobile camera + Live Agent (Gemini) for real-time descriptions and Q&A.

- **Backend:** [museeum-api/](museeum-api/) — Node/TS, Express, WebSocket bridge to Gemini Live.
- **Frontend:** [museeum-web/](museeum-web/) — React/TS, Vite, camera + push-to-talk.

See [prd.md](prd.md) and [ARCHITECTURE.md](ARCHITECTURE.md) for full product and architecture.

## Deploy on Google Cloud

From this directory:

1. **One-time setup:** `make setup`
2. **Deploy both:** `make deploy` or `GEMINI_API_KEY=xxx make deploy`
3. **Help:** `make help`

Full instructions and options: [docs/deploy-gcp.md](docs/deploy-gcp.md).

## Run locally

- Backend: `cd museeum-api && npm install && npm run dev` (set `GEMINI_API_KEY` in `.env`)
- Frontend: `cd museeum-web && npm install && VITE_API_URL=http://localhost:8080 npm run dev`
