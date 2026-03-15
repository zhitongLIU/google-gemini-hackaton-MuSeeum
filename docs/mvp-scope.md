# MuSeeum MVP scope

The **MVP** implements only:

- **Mobile-first camera** — full-screen camera view; optional “Describe this” to capture one frame.
- **Session** — `POST /api/session` → `sessionId` (in-memory; no Google Drive).
- **Live Agent** — WebSocket `WS /api/live/:sessionId`; push-to-talk sends audio (and optional image); backend bridges to **Gemini Live API**; docent persona responds with text (and optionally audio).

**Out of scope for MVP** (post-MVP):

- Two-phase Art Info + Docent flow (artwork capture → confirm → explanation).
- Google Drive `index.json` and visit folders.
- End visit, summary, downloadable diary (HTML/PDF).
- Google Sign-In / Drive scope (guest-only for MVP).

See [docs/plans/2026-03-14-mvp-live-camera.md](plans/2026-03-14-mvp-live-camera.md) for the implementation plan.
