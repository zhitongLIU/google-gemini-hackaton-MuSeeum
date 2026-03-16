# MuSeeum – PRD (Cursor-friendly)

> **Quick reference:** AI museum companion. Artwork analysis is **two-phase**: (1) **Art Info Agent** (Gemini + Google Search/Wikipedia grounding) finds artist, museum, date; (2) **Docent Agent** describes and presents the work after user confirmation or 5s timeout. During visit: Live Agent (camera + voice) for Q&A. After visit: Gemini generates a personalized tour story. Stack: React/TS frontend, Node/TS backend on Cloud Run, **localStorage in the webapp** (hackathon; no Google Drive), Gemini Live API + GenAI SDK/ADK. **No login implementation;** access code only (judge/organizer). WebSocket `/api/live/:sessionId` is already built.

---

## 1. Context & goal

- **Product:** MuSeeum – AI museum companion (Live Agent + tour story).
- **Hackathon:** Gemini Live Agent Challenge; budget-friendly demo.
- **Must use:** Gemini (incl. Live API), GenAI SDK/ADK, backend on Google Cloud, ≥1 GCP service, new project, English demo/docs.
- **Category:** Live Agents.

### 1.1 Persona & tone

- **Persona:** Friendly museum docent – knowledgeable but approachable, not stuffy.
- **Tone:** Accessible and curious; suitable for all ages. Explanations are visitor-friendly (short summaries, context, and stories).
- **Voice (Live Agent):** The Live Agent’s spoken replies and explanation playback should feel consistent with this persona (judging: “distinct persona/voice”).

---

## 2. Architecture (high-level)

| Layer        | Choice                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Frontend** | React SPA, TypeScript, browser (desktop + mobile), camera + mic                                                              |
| **Backend**  | Node.js (TypeScript), Express or Fastify, Cloud Run (scale-to-zero)                                                          |
| **DB**       | **Local storage in the webapp** (hackathon): sessions, artworks, photos, and summaries stored in **localStorage** (frontend). Backend remains stateless for persistence (in-memory session id for Live WebSocket only). |
| **Storage**  | **Local storage**: images (base64) and all visit data stored in the webapp’s localStorage under a single key (e.g. `museeum_data`). No server-side persistence. |
| **Auth**     | **No login implementation.** Access code only (judge/organizer code); no Google Sign-In or Drive scope. Backend validates access code on `POST /session` and WebSocket. |
| **AI**       | **Two agents:** (1) **Art Info Agent** — Gemini + grounding (Google Search and/or Wikipedia) to find artist, museum, date of production; returns candidate for confirmation. (2) **Docent Agent** — Gemini (text, optionally Live) for visitor-friendly description and museum-docent presentation; runs after confirmation or 5s timeout. GenAI SDK/ADK; standard Gemini text for end-of-tour story. |

**Grounding:** The Art Info Agent uses Google Search and/or Wikipedia to ground artwork metadata (artist, museum, date); no fabrication of museum/artist/date. The Docent Agent uses the confirmed art info and does not fabricate facts.

**Repositories:** Backend and frontend live in **separate Git repositories** (both public on GitHub):

- **Backend:** `museeum-api` – Node/TS API, Cloud Run, Gemini (no Drive; stateless for artwork/summary).
- **Frontend:** `museeum-web` – React/TS SPA, camera + mic, calls backend API and Live WebSocket.

**Note:** Museum is **discovered by the Art Info Agent** via grounding (Google Search/Wikipedia), not asked up front. When the user taps “Take a Photo” or “Upload from Gallery”, we do **not** ask for museum location; the agent finds it from the artwork image. Optional: user can set or correct museum later (e.g. Edit Museum).

### 2.1 Reference: Way Back Home (agent-building hands-on example)

MuSeeum’s front/back/agent communication and Google Cloud deployment follow patterns from the **Way Back Home** workshop. Use that project as the reference for agent building and deployment.

| Component | Way Back Home | MuSeeum analogue |
| --------- | ------------- | ----------------- |
| **Frontend** | `way-back-home/dashboard/frontend` (Next.js) | `museeum-web` (React/TS SPA) |
| **Backend** | `way-back-home/dashboard/backend` (FastAPI, Firestore, Firebase Storage) | `museeum-api` (Node/TS, stateless; frontend uses localStorage) |
| **Agent (orchestrator)** | `way-back-home/solutions/level_1/agent` (ADK root agent + sub-agents) | Art Info Agent + Docent Agent (invoked by backend per request) |
| **Level 0 / setup** | `way-back-home/solutions/level_0` (generator script, e.g. avatar) | One-time or per-session setup; no separate “level_0” service |
| **Tool / MCP server** | `way-back-home/solutions/level_1/mcp-server` (FastMCP on Cloud Run) | Optional: custom tools or MCP if needed; Gemini + grounding is primary |

**Communication pattern (Way Back Home):**

- **Frontend → Backend only.** Frontend uses a single API base URL (`NEXT_PUBLIC_API_URL` / `API_BASE_URL`). No direct frontend–agent calls.
- **Backend = source of truth.** Backend stores participants/events (Firestore) and evidence (Storage). Exposes REST: `GET /participants/:id` (includes `evidence_urls`), `PATCH /participants/:id/location`, etc.
- **Agent gets context from backend.** The Level 1 agent uses a `before_agent_callback`: reads `PARTICIPANT_ID` and `BACKEND_URL` from env, fetches `GET /participants/:id`, and sets state (e.g. `soil_url`, `flora_url`, `stars_url`) for sub-agents. Sub-agents use `{key}` state templating; no config files.
- **Agent writes back via tools.** The `confirm_location` tool uses `ToolContext` (participant_id, backend_url from state) and calls `PATCH backend/participants/:id/location`. Backend updates DB; frontend sees updated state on next poll.

**Deployment (Way Back Home):**

- **Backend:** Dockerfile → Cloud Run (port 8080). Env: `GOOGLE_CLOUD_PROJECT`, `API_BASE_URL`, `MAP_BASE_URL`, Firestore/Storage config.
- **Frontend:** Multi-stage Dockerfile (Next.js standalone) → Cloud Run or static host. Build args: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FRONTEND_URL`.
- **Agent:** ADK app exposed via A2A (`to_a2a(root_agent)`) on Cloud Run; env: `PARTICIPANT_ID`, `BACKEND_URL`, `PUBLIC_URL`.
- **MCP server:** FastMCP with HTTP transport → Cloud Run (`cloudbuild.yaml`); env: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`.

**MuSeeum application:**

- **Frontend** talks only to **backend** (REST + WebSocket for Live). Same single-API pattern; no agent URLs in the client.
- **Backend** owns all HTTP entrypoints. It **invokes** Art Info Agent and Docent Agent in-process (or via serverless) on `POST /session/:id/artwork` and `POST /session/:id/artwork/confirm`. No A2A required unless we introduce separate agent services later.
- **Backend** is the only service that talks to Gemini (grounding, Live, text). Env: `GOOGLE_CLOUD_PROJECT`, Gemini API, `API_BASE_URL` for CORS. Listing and full session/artwork data come from **frontend localStorage**; backend exposes stateless `POST /session/:id/artwork` and `POST /session/:id/artwork/confirm` returning candidate and explanation only.
- **Deployment on Google Cloud:** Backend and frontend each have a Dockerfile and deploy to Cloud Run (or frontend to a static host). Use Cloud Build or GitHub Actions; same env and secret handling as Way Back Home (env vars, Secret Manager if needed).

---

## 3. API reference (backend)

Access control: **access code** (judge/organizer) sent in body or header; required when `JUDGE_ACCESS_CODE` is set. Base path: `/api`. **Listing and full session/artwork data come from frontend localStorage**; no `GET /session` or `GET /session/:id` required for persistence.

| Method | Path                                     | Body / params            | Response / action                                                                                                                                 |
| ------ | ---------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/session`                               | `{ museumName?: string, accessCode?: string }` | Create session → `{ sessionId }`. Used for Live WebSocket; frontend stores session in localStorage. Museum optional; Art Info Agent returns museum in candidate. |
| POST   | `/session/:id/artwork`                   | `{ image: base64, notes?: string }` | **Stateless. Agent 1 only.** Art Info Agent (Gemini + Google Search/Wiki grounding) → return **candidate** (title, artist, museum?, year?, period, confidence). No server-side storage. |
| POST   | `/session/:id/artwork/confirm`           | `{ title, artist?, period?, year?, museumName?, correctedTitle? }` | **Stateless. Agent 2.** Docent Agent → return `{ artworkId, title, artist, explanationText, sections?, tags? }`. Frontend saves to localStorage. |
| POST   | `/session/:id/artwork/:artworkId/photos` | `{ image: base64 }`      | Optional: add photo to same piece → return updated image list. Frontend persists in localStorage. |
| WS     | `/live/:sessionId`                       | query: `accessCode`, `appId` | WebSocket: user audio ↔ Gemini Live ↔ streaming text/audio. **Already built.** |
| POST   | `/session/:id/summary`                   | `{ artworks: [...] }` (optional) | Stateless: generate story from artwork list → `{ summaryText, sections }`. Frontend stores summary in localStorage. |

---

## 4. Data model

### 4.1 Hackathon: localStorage (webapp)

For this hackathon, **all sessions, artworks, photos, and summaries** are stored in the **webapp’s localStorage** under a single key (e.g. `museeum_data`). No Google Drive; no server-side persistence of visit data.

**Stored object shape (example):**

```
{
  "version": 1,
  "sessions": [
    { "id": "...", "museumName": "...", "startedAt": "...", "endedAt": null, "status": "active" }
  ],
  "artworks": [
    {
      "id": "...",
      "sessionId": "...",
      "createdAt": "...",
      "photos": ["data:image/jpeg;base64,..."],
      "title": "...",
      "artist": "...",
      "period": "...",
      "year": "...",
      "museumName": "...",
      "explanationText": "...",
      "tags": [],
      "sections": {},
      "confirmationSource": "auto" | "voice" | "typed",
      "liked": false,
      "confirmed": true,
      "candidate": { "title", "artist", "museum?", "year?", "period", "confidence" }
    }
  ],
  "summaries": [
    { "sessionId": "...", "summaryText": "...", "sections": [{ "artworkTitle", "artist?", "shortStory" }], "createdAt": "..." }
  ]
}
```

Images are stored as **base64 data URLs** in each artwork’s `photos` array. The backend does not store this data; it only returns AI results (candidate, explanation, summary) per request.

---

## 5. User flows (implementation order)

### 5.1 Start visit (no login)

1. User opens app → if required, enter **access code** (judge/organizer); no login or Google Sign-In.
2. **VisitHome:** “Start new museum visit” or go straight to capture: **museum is not asked** when user taps “Take a Photo” or “Upload from Gallery”; the Art Info Agent discovers museum from the first artwork.
3. When user first captures an artwork (photo or upload), frontend creates a session: `POST /api/session` (with access code); backend returns `sessionId`. Frontend stores the new session in **localStorage** and uses `sessionId` for Live WebSocket and artwork API calls.
4. Museum name can be updated later from the Art Info Agent candidate or via Edit Museum (stored in localStorage).
5. Session = tour diary for that visit (all artworks/explanations stored in localStorage). Sessions are **resumable**: from VisitHome, the user can open an existing **active** session and continue (capture more artworks, use Live Q&A, then End visit).

**Done when:** Access code (if required) → VisitHome → or tap Take Photo/Upload → session created on first capture → sessionId in state/URL and localStorage.

---

### 5.2 Capture artwork → confirm → explanation (two-phase, Live interaction)

**Phase 1 — Art info (Agent 1)**

1. User taps **“Take a Photo”** or **“Upload from Gallery”** → no museum picker; camera or gallery opens directly. After capture, frontend creates a session if needed (without museum name, or with placeholder), then sends the image.
2. Frontend: `POST /api/session/:id/artwork` with image only (no museum asked; agent will find museum).
3. Backend: **Art Info Agent** uses Gemini + **Google Search / Wikipedia** grounding to identify artwork and return: artist, **museum** (discovered via grounding), date of production, period, title, confidence.
4. Backend returns **candidate** only (no long description yet): `{ tempId?, candidate: { title, artist, museum?, year?, period, confidence } }`.
5. Frontend: Show candidate on **Live Identification (XLRyj)**: “We think this is [title] by [artist], [museum], [date]. Correct?”
6. **Confirmation rule:** Wait for user to confirm (Yes / No / type myself) **or** **5 seconds without response** → treat as confirmed and proceed to Phase 2. (Frontend may implement a 5s timer and call the confirm endpoint automatically if the user does not respond.)

**Phase 2 — Docent description (Agent 2)**

7. On confirm (or 5s timeout): Frontend calls `POST /api/session/:id/artwork/confirm` with candidate or user-corrected title (and optional artist, period, year, museumName).
8. Backend: **Docent Agent** uses Gemini to generate visitor-friendly description and museum-docent presentation (style, history, artist, period, short summary). Returns result only; **frontend** saves the artwork (including images) to **localStorage** and shows **Artwork Analysis (vE9pj)**.
9. Backend returns `{ artworkId, title, artist, explanationText, sections?, tags?, ... }`; frontend persists to localStorage and shows **Artwork Analysis (vE9pj)**.
10. Option: “Add more photos” → `POST /api/session/:id/artwork/:artworkId/photos`.

- **No / I’ll type it myself:** User enters title; frontend sends corrected title to confirm endpoint → Docent Agent still runs with user-provided title and creates `artwork_event`.
- **Fallback:** If Agent 1 cannot identify the artwork, ask user for title and run only Agent 2 (docent) with that input.

**Done when:** Capture → candidate shown → Yes/No/type myself (or 5s) → Docent Agent explanation + optional add photos; errors (camera, backend) show toasts.

Flow detail: [docs/flow-museum-tour-diary.md](docs/flow-museum-tour-diary.md).

---

### 5.3 Live Q&A (Gemini Live Agent)

1. **LiveVisit:** user holds “Talk” → voice question.
2. Frontend: stream mic audio over WebSocket to `WS /api/live/:sessionId`.
3. Backend: maintain Gemini Live session for sessionId; send audio + **mandatory** latest artwork context when available (last captured/confirmed artwork title, artist, and short snippet). If no artwork has been captured yet, send session context only (e.g. museum name). Stream text/audio back.
4. Release “Talk” = stop send; next question continues in same session.

**Done when:** Push-to-talk → stream audio → receive streaming reply; interrupt by releasing Talk.

---

### 5.4 End visit & generate story

1. User taps “End Visit”.
2. Frontend: optionally `POST /api/session/:id/summary` with artworks from localStorage; backend returns `{ summaryText, sections }` (stateless).
3. Frontend: set `session.status = 'completed'`, `endedAt` in localStorage; store summary in localStorage.
4. **VisitSummary:** show story; **downloadable diary** (see export formats below) built from **localStorage** + optional “Copy text”.

**Done when:** End visit → summary generated → VisitSummary screen shows intro/sections/closing + user can download diary.

---

### 5.5 Downloadable diary (export formats)

When the visit ends, the user gets a **downloadable diary** built from: session (museum name, date range), generated story (intro, sections, closing), and **per-artwork content** (title, artist, period, saved art description, **at least one image per artwork when available** – required for demo). Export as **HTML** or **PDF**.

| Format                 | Pros                                                                                                                                                                   | Cons                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **HTML (single file)** | Opens in any browser; embedded artwork images (base64 or URLs) **required** per artwork when captured; presentable in demo; user can “Print → Save as PDF” if desired. | Template + image embedding.                             |
| **PDF**                | Universal, printable, booklet-style. Strong for submission and sharing.                                                                                                | Requires a lib (e.g. jsPDF, react-pdf, or server-side). |

**Implementation:** Build diary content from **localStorage** (session + summary + artworks for that session). VisitSummary offers two actions: **“Download as HTML”** and **“Download as PDF”**. Frontend assembles the chosen format and triggers download. HTML: template + inline CSS + embedded base64 images; PDF via client lib (e.g. jsPDF) or print-to-PDF.

---

## 6. Frontend (React/TS) – pages & components

| Page / area            | Responsibility                                                                                                                                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Access code gate**   | Optional full-screen form when judge access code is required; on submit store code, then show VisitHome. No login or Google OAuth.                                                                                                                                                            |
| **VisitHome**          | “Start museum visit” (museum not asked when user taps Take Photo/Upload — agent finds it); list previous sessions from **localStorage** (museum, date, view summary). List shows active and completed sessions; user can **Continue** an active session or **View summary** for completed ones. |
| **LiveIdentification** | `XLRyj`                                                                                                                                                                                                                                                                                        | Dark immersive UI; captured photo + AI waveform indicator + real-time voice transcript; **push-to-talk mic** for voice confirmation via Gemini Live Agent (interruptible); "Or type it myself" text fallback. Gate before Artwork Analysis. |
| **LiveVisit**          | _(not prototyped)_                                                                                                                                                                                                                                                                             | Session info (museum, diary); camera + "Capture artwork"; "Talk" (voice); last explanation + transcript (explanation playback via **Gemini streaming audio**); "End visit"; toasts for errors                                               |
| **VisitSummary**       | _(not prototyped)_                                                                                                                                                                                                                                                                             | Intro, per-artwork sections, closing; **downloadable diary** (Download as **HTML** or **PDF**); optional copy text                                                                                                                          |

**Behavior:** React Query (or similar) for REST + cache; `sessionId` in state or URL; basic styling (aesthetics low priority).

---

## 7. Backend (Node/TS) – endpoints checklist

- `POST /api/session` – body `{ museumName?, accessCode? }` → create session → `{ sessionId }`. Used for Live WebSocket; frontend stores session in localStorage.
- `POST /api/session/:id/artwork` – image (base64) → **Art Info Agent** (Gemini + Google Search/Wiki grounding) → return **candidate** (stateless). No server-side storage.
- `POST /api/session/:id/artwork/confirm` – body with title, artist?, etc. → **Docent Agent** → return explanation (stateless). Frontend saves to localStorage.
- `POST /api/session/:id/artwork/:artworkId/photos` – optional; add photo → return image list. Frontend persists in localStorage.
- `WS /api/live/:sessionId` – Live Agent audio streaming (already built).
- `POST /api/session/:id/summary` – optional; body with artworks → generate story → `{ summaryText, sections }` (stateless). Frontend stores summary in localStorage.

---

## 8. Non-functional & cost

- **Cost:** Cloud Run min instances = 0, small CPU/RAM; no server-side storage (localStorage in webapp); no extra always-on services.
- **Simplicity:** Clear errors; Cloud Logging for API and Gemini.
- **Latency:** Streaming from Gemini Live for voice; “good enough” latency.

---

## 9. Rule compliance & judging

- **Rules:** New project, contest period; Live Agents category; Gemini + GenAI SDK/ADK; Cloud Run; UI and video in English.
- **Innovation & UX (40%):** Real-time speech + vision; Live Agent has a defined **persona/voice** (see §1.1 Persona); **barge-in** supported (release Talk = interrupt); minimal UI (camera, talk button, spoken feedback).
- **Technical (30%):** Clear layers (React, Node, Gemini, localStorage); **Grounding:** art metadata (artist, museum, date) is grounded via Google Search and/or Wikipedia in the Art Info Agent; Docent Agent uses confirmed info and does not fabricate facts; clean APIs and data model.
- **Demo (30%):** Happy path ~60–90 s: Access code (if required) → Start visit → Capture 1–2 artworks → One voice question → End visit → Story. Optional “About / Architecture” in app.

**Extra:** CI/CD for deployment automation; README note for optional “how MuSeeum uses Gemini Live + GCP” content. **Proof of GCP:** Backend on Cloud Run; include short screen recording (e.g. Cloud Run dashboard or live API URL) or code pointer per hackathon rules.

### 9.1 Submission checklist (qualify)

To qualify, the submission must include (per [docs/rules.md](docs/rules.md) and [hackathon presentation video](docs/hackaton_presentation_video_transcript.md)):

| Requirement                  | MuSeeum implementation                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public code repository**   | URL(s) to **`museeum-api`** and **`museeum-web`** (or single org/portfolio link listing both). Repos must be public for judging.                                                                   |
| **Architecture diagram**     | Clear visual of system: how **Gemini/ADK** connects to backend, database, and frontend. Include in submission (e.g. image carousel); see ARCHITECTURE.md.                                          |
| **Setup guide**              | README in each repo with step-by-step spin-up (local or deploy). Proves project is reproducible.                                                                                                   |
| **Demo video**               | **<4 minutes**; uploaded to **YouTube or Vimeo**, publicly visible. Show multimodal/agentic features **in real time (no mockups)**. Pitch: problem + solution value. English or English subtitles. |
| **Proof of Google Cloud**    | Short recording **separate from demo**: e.g. Cloud Run dashboard, console view, or live backend URL; or link to code file showing GCP usage.                                                       |
| **Hosted project / testing** | Link to **website or functioning demo** for judges. If the app is private, include **login credentials** in testing instructions.                                                                  |

### 9.2 Bonus points (optional)

- **Publish content:** Blog, podcast, or video on how the project was built with Google AI + Google Cloud (e.g. medium.com, dev.to, YouTube). Must state created for this hackathon. Use **#GeminiLiveAgentChallenge** when sharing on social.
- **Automate deployment:** Scripts or infrastructure-as-code in the public repo (e.g. Cloud Build, GitHub Actions).
- **GDG membership:** Link to public Google Developer Group profile for bonus points.

---

## 10. CI/CD (Google Cloud)

- **Repos:** Two separate GitHub (public) repositories: **`museeum-api`** (backend), **`museeum-web`** (frontend).
- **Backend (`museeum-api`):** Dockerfile (Node/TS build → run server). Deploy to Cloud Run service `museum-guide-api` via Cloud Build (`cloudbuild.yaml`) or GitHub Actions (gcloud). Trigger: push to `main` → run tests (if any) → build image → deploy.
- **Frontend (`museeum-web`):** Build config; deploy to **Vercel** (or any static host). Trigger: push to `main` → build → deploy.
- **README (each repo):** Local dev for that repo; how to run with the other (e.g. backend URL / env); env vars (Google Client ID + Gemini for frontend/backend); “screenshot/recording of Cloud Run console” for submission (backend).

---

## 11. Deliverables (for coding agent)

- **Repositories:** Backend in **`museeum-api`**, frontend in **`museeum-web`** (separate Git repos, both public on GitHub).
- Backend Node/TS: session, artwork, confirm, optional summary endpoints; Gemini (Live + text). No server-side persistence; **access code only** (no login).
- React/TS frontend: Access code gate, VisitHome, Live Identification, Artwork Analysis, Museum Gallery Grid, VisitSummary, Favorites, Collection Stats; **localStorage** for sessions/artworks/photos; camera + audio + basic styling.
- Backend Dockerfile; frontend build config.
- CI/CD (cloudbuild.yaml or GitHub Actions) for Cloud Run (backend); Vercel (or static host) deploy for frontend.
- README.md in each repo: setup and deployment for that repo; how to run with the other.
- Downloadable diary: art descriptions saved per artwork; **must include at least one image per artwork when available**; on “End visit”, offer **Download as HTML** and **Download as PDF**.
- ARCHITECTURE.md: components and data flow; diagram must show **Gemini/ADK** integration with backend, database, and frontend (for submission and video).
- **Submission:** Demo video on YouTube or Vimeo (<4 min, real-time, no mockups, pitch + value); hosted project URL or functioning demo link; if private, testing instructions with login credentials. See §9.1.

---

## 12. Cursor / agent notes

- **@prd.md** – this file; use sections 2–7 for implementation.
- **@implementation.md** – screen-by-screen Pencil node IDs, navigation flows, interactive elements, design tokens. Use as the single source of truth for UI implementation.
- **Prototype:** `muSeeum.pen` – Pencil file with all 11 screens + 11 navigation-note annotations. Read via Pencil MCP tools only.
- **APIs:** Section 3 is the single source of truth for routes and payloads.
- **Data:** Section 4 is the single source for localStorage structure (hackathon).
- **Order:** Implement flows in order 5.1 → 5.2 → 5.3 → 5.4; backend endpoints and frontend pages can be built in parallel per flow.
- **Two-agent artwork flow:** **Agent 1 (Art Info):** vision + Google Search/Wikipedia grounding → artist, museum, date, period, title → candidate for confirmation. **Agent 2 (Docent):** after user confirm or 5s timeout → visitor-friendly description and museum-docent presentation. Implement on `XLRyj` (Live Identification): show Art Info result, then confirm by voice (push-to-talk) or "Or type it myself"; if no response within 5s, treat as confirmed and call confirm endpoint. Support merge for duplicate photos of same artwork.
- **Live Agent:** One WebSocket per session; maintain context for sessionId; support interrupt (release Talk).
- **Screen ↔ Node mapping:** When implementing a screen, reference the Pencil node ID from §6.1 and the detailed flow in [implementation.md](implementation.md). Use `batch_get` with the node ID to inspect exact layout and properties.
