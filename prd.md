# MuSeeum – PRD (Cursor-friendly)

> **Quick reference:** AI museum companion. Artwork analysis is **two-phase**: (1) **Art Info Agent** (Gemini + Google Search/Wikipedia grounding) finds artist, museum, date; (2) **Docent Agent** describes and presents the work after user confirmation or 5s timeout. During visit: Live Agent (camera + voice) for Q&A. After visit: Gemini generates a personalized tour story. Stack: React/TS frontend, Node/TS backend on Cloud Run, **Google Drive (folders + index.json)**, Gemini Live API + GenAI SDK/ADK, Google Sign-In (Drive scope).

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
| **DB**       | **Google Drive**: `index.json` in an app folder (sessions, artworks, summaries, temp entries)                               |
| **Storage**  | **Google Drive**: images saved as files in per-visit subfolders                                                              |
| **Auth**     | **Optional** Google OAuth (Google Identity Services) with Drive scope; backend validates **access tokens** via Google userinfo. Guest mode stores data locally in sessionStorage + cookies. |
| **AI**       | **Two agents:** (1) **Art Info Agent** — Gemini + grounding (Google Search and/or Wikipedia) to find artist, museum, date of production; returns candidate for confirmation. (2) **Docent Agent** — Gemini (text, optionally Live) for visitor-friendly description and museum-docent presentation; runs after confirmation or 5s timeout. GenAI SDK/ADK; standard Gemini text for end-of-tour story. |

**Grounding:** The Art Info Agent uses Google Search and/or Wikipedia to ground artwork metadata (artist, museum, date); no fabrication of museum/artist/date. The Docent Agent uses the confirmed art info and does not fabricate facts.

**Repositories:** Backend and frontend live in **separate Git repositories** (both public on GitHub):

- **Backend:** `museeum-api` – Node/TS API, Cloud Run, Google Drive, Gemini.
- **Frontend:** `museeum-web` – React/TS SPA, camera + mic, calls backend API and Live WebSocket.

**Note:** Museum is **discovered by the Art Info Agent** via grounding (Google Search/Wikipedia), not asked up front. When the user taps “Take a Photo” or “Upload from Gallery”, we do **not** ask for museum location; the agent finds it from the artwork image. Optional: user can set or correct museum later (e.g. Edit Museum).

### 2.1 Reference: Way Back Home (agent-building hands-on example)

MuSeeum’s front/back/agent communication and Google Cloud deployment follow patterns from the **Way Back Home** workshop. Use that project as the reference for agent building and deployment.

| Component | Way Back Home | MuSeeum analogue |
| --------- | ------------- | ----------------- |
| **Frontend** | `way-back-home/dashboard/frontend` (Next.js) | `museeum-web` (React/TS SPA) |
| **Backend** | `way-back-home/dashboard/backend` (FastAPI, Firestore, Firebase Storage) | `museeum-api` (Node/TS, Google Drive `index.json`) |
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
- **Backend** is the only service that talks to Gemini (grounding, Live, text), Drive, and (optionally) any MCP or tool service. Env: `GOOGLE_CLOUD_PROJECT`, Drive credentials, Gemini API, `API_BASE_URL` for CORS and callbacks.
- **Deployment on Google Cloud:** Backend and frontend each have a Dockerfile and deploy to Cloud Run (or frontend to a static host). Use Cloud Build or GitHub Actions; same env and secret handling as Way Back Home (env vars, Secret Manager if needed).

---

## 3. API reference (backend)

All endpoints require auth (Google **access token** with Drive scope). Base path: `/api`.

| Method | Path                                     | Body / params            | Response / action                                                                                                                             |
| ------ | ---------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| POST   | `/session`                               | `{ museumName?: string }` | Create session → `{ sessionId }`. Museum optional; when user takes/uploads photo without setting museum, create with no museum (or placeholder); Art Info Agent returns museum in candidate. |
| GET    | `/session`                               | —                        | List sessions for user (minimal + has summary?)                                                                                               |
| GET    | `/session/:id`                           | —                        | Session details + summary if present                                                                                                          |
| POST   | `/session/:id/artwork`                   | `{ image: file \| base64, notes?: string, museumName?: string }`                                                                              | **Agent 1 only.** Art Info Agent (Gemini + Google Search/Wiki grounding) → return **candidate** (title, artist, museum, date, period, confidence) for confirmation; no full explanation yet. |
| POST   | `/session/:id/artwork/confirm`           | `{ tempId?, title, artist?, period?, year?, correctedTitle?, museumName? }`                                                                   | **Agent 2.** On user confirm (or 5s auto-confirm): Docent Agent generates full explanation and museum-docent presentation → save artwork event → return `{ artworkId, title, artist, explanationText, sections?, ... }`. |
| POST   | `/session/:id/artwork/:artworkId/photos` | `{ image: file           | base64 }`                                                                                                                                     | Add photo to same piece → `{ artworkId, imageUrls }`                                                                |
| WS     | `/live/:sessionId`                       | —                        | WebSocket: user audio ↔ Gemini Live ↔ streaming text/audio. Server injects current artwork context (when available) into Gemini Live session. |
| POST   | `/session/:id/summary`                   | —                        | Mark session completed, generate story → `{ summaryText, sections }`                                                                          |

---

## 4. Data model (Google Drive)

**Drive structure (per user):**

- **App folder**: `MuSeeum/` (created in the user’s Google Drive root)
- **Index file**: `MuSeeum/index.json` — single source of truth “database”
- **Visit folders**: `MuSeeum/<sessionId>-<museumName>/` — images stored as files

**`index.json` shape (example):**

```
{
  "version": 1,
  "user": { "id": "googleUserId", "name": "Name", "email": "user@email.com" },
  "sessions": [
    { "id": "...", "userId": "...", "museumName": "...", "startedAt": "...", "endedAt": null, "status": "active", "folderId": "driveFolderId" }
  ],
  "artworks": [
    {
      "id": "...",
      "sessionId": "...",
      "createdAt": "...",
      "photos": ["data:image/jpeg;base64,..."],
      "photoFileIds": ["driveFileId"],
      "title": "...",
      "artist": "...",
      "period": "...",
      "year": "...",
      "explanationText": "...",
      "tags": [],
      "sections": {},
      "confirmationSource": "auto",
      "liked": false,
      "confirmed": true
    }
  ],
  "summaries": [
    { "sessionId": "...", "summaryText": "...", "sections": [], "createdAt": "..." }
  ],
  "tempArtworks": [
    { "id": "...", "sessionId": "...", "imageBase64": "...", "mimeType": "image/jpeg", "expiresAt": "..." }
  ]
}
```

Images are stored **as Drive files** in the visit folder; the index keeps a lightweight list of Drive file IDs and a base64 preview for quick UI rendering.

**Guest mode (no sign-in):**

- All sessions/artworks/summaries are stored in **`sessionStorage`**.
- A session cookie `museeum.guest=1` marks guest usage for analytics/debug.
- Data is ephemeral and cleared when the browser session ends.

---

## 5. User flows (implementation order)

### 5.1 Sign in & start visit

1. User opens app → optionally signs in with Google (guest mode allowed).
2. **VisitHome:** “Start new museum visit” or go straight to capture: **museum is not asked** when user taps “Take a Photo” or “Upload from Gallery”; the Art Info Agent discovers museum from the first artwork.
3. When user first captures an artwork (photo or upload), frontend creates a session: `POST /api/session` with `{ museumName }` optional (omit or use placeholder like “To be identified”). Backend returns `sessionId`.
4. Backend (signed-in): create session in **Drive `index.json`** and a visit subfolder → return `sessionId`. Museum name can be updated later from the Art Info Agent candidate or via Edit Museum.
5. Guest mode: session stored in **sessionStorage** and a guest cookie.
6. Session = tour diary for that visit (all artworks/explanations tied to it). Sessions are **resumable**: from VisitHome, the user can open an existing **active** session and continue (capture more artworks, use Live Q&A, then End visit).

**Done when:** LoginPage → VisitHome → (optional) start visit → or tap Take Photo/Upload → session created on first capture without museum prompt → sessionId in state/URL.

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
8. Backend: **Docent Agent** uses Gemini to generate visitor-friendly description and museum-docent presentation (style, history, artist, period, short summary). Saves image to Drive (signed-in) or in-memory (guest), updates `index.json` / sessionStorage with `artwork_event`.
9. Backend returns `{ artworkId, title, artist, explanationText, sections?, tags?, ... }`; frontend shows **Artwork Analysis (vE9pj)**.
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
2. Frontend: `POST /api/session/:id/summary`.
3. Backend: set `session.status = 'completed'`, `endedAt`; load all `artwork_events`; call Gemini text with prompt + list of artworks (titles, artists, snippets, timestamps) → story with at least: intro paragraph, array of sections (artworkTitle, artist, shortStory), closing paragraph.
4. Store in `summaries`: `{ sessionId, summaryText, sections, createdAt }`; return to frontend.
5. **VisitSummary:** show story; **downloadable diary** (see export formats below) + optional “Copy text”.

**Done when:** End visit → summary generated → VisitSummary screen shows intro/sections/closing + user can download diary.

---

### 5.5 Downloadable diary (export formats)

When the visit ends, the user gets a **downloadable diary** built from: session (museum name, date range), generated story (intro, sections, closing), and **per-artwork content** (title, artist, period, saved art description, **at least one image per artwork when available** – required for demo). Export as **HTML** or **PDF**.

| Format                 | Pros                                                                                                                                                                   | Cons                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **HTML (single file)** | Opens in any browser; embedded artwork images (base64 or URLs) **required** per artwork when captured; presentable in demo; user can “Print → Save as PDF” if desired. | Template + image embedding.                             |
| **PDF**                | Universal, printable, booklet-style. Strong for submission and sharing.                                                                                                | Requires a lib (e.g. jsPDF, react-pdf, or server-side). |

**Implementation:** Build diary content from `GET /api/session/:id` (session + summary + artworkEvents). VisitSummary offers two actions: **“Download as HTML”** and **“Download as PDF”**. Frontend (or a small backend endpoint) assembles the chosen format and triggers download. HTML can be generated first (template + inline CSS); PDF via client lib (e.g. jsPDF) or by rendering the same content and calling print-to-PDF.

---

## 6. Frontend (React/TS) – pages & components

| Page / area            | Responsibility                                                                                                                                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LoginPage**          | Google OAuth (Drive scope); on success store access token, redirect to VisitHome                                                                                                                                                                                                              |
| **VisitHome**          | “Start museum visit” (museum not asked when user taps Take Photo/Upload — agent finds it); list previous sessions (museum, date, view summary); `GET /api/session`. List shows active and completed sessions; user can **Continue** an active session (navigate to LiveVisit with that sessionId) or **View summary** for completed ones. |
| **LiveIdentification** | `XLRyj`                                                                                                                                                                                                                                                                                        | Dark immersive UI; captured photo + AI waveform indicator + real-time voice transcript; **push-to-talk mic** for voice confirmation via Gemini Live Agent (interruptible); "Or type it myself" text fallback. Gate before Artwork Analysis. |
| **LiveVisit**          | _(not prototyped)_                                                                                                                                                                                                                                                                             | Session info (museum, diary); camera + "Capture artwork"; "Talk" (voice); last explanation + transcript (explanation playback via **Gemini streaming audio**); "End visit"; toasts for errors                                               |
| **VisitSummary**       | _(not prototyped)_                                                                                                                                                                                                                                                                             | Intro, per-artwork sections, closing; **downloadable diary** (Download as **HTML** or **PDF**); optional copy text                                                                                                                          |

**Behavior:** React Query (or similar) for REST + cache; `sessionId` in state or URL; basic styling (aesthetics low priority).

---

## 7. Backend (Node/TS) – endpoints checklist

- `POST /api/session` – body `{ museumName? }` (optional) → create session → `{ sessionId }`. Omit museum when user goes via Take Photo/Upload; Art Info Agent returns museum in candidate.
- `GET /api/session` – list user sessions (include active sessions so user can resume)
- `GET /api/session/:id` – session + summary if present (enough data to resume active session)
- `POST /api/session/:id/artwork` – image → **Art Info Agent** (Gemini + Google Search/Wiki grounding) → return **candidate** for confirmation (includes **museum** discovered by agent). No docent text yet. Do not require museum from user.
- `POST /api/session/:id/artwork/confirm` – candidate or user title → **Docent Agent** → full explanation + artwork event. If user does not respond within 5s, frontend may treat as confirm and call this endpoint automatically.
- `POST /api/session/:id/artwork/:artworkId/photos` – add photo to same piece (also used for merge)
- `WS /api/live/:sessionId` – Live Agent audio streaming
- `POST /api/session/:id/summary` – complete session, generate and store story → `{ summaryText, sections }`

---

## 8. Non-functional & cost

- **Cost:** Cloud Run min instances = 0, small CPU/RAM; Drive storage on the user’s account; no extra always-on services.
- **Simplicity:** Clear errors; Cloud Logging for API and Gemini.
- **Latency:** Streaming from Gemini Live for voice; “good enough” latency.

---

## 9. Rule compliance & judging

- **Rules:** New project, contest period; Live Agents category; Gemini + GenAI SDK/ADK; Cloud Run + Google Drive; UI and video in English.
- **Innovation & UX (40%):** Real-time speech + vision; Live Agent has a defined **persona/voice** (see §1.1 Persona); **barge-in** supported (release Talk = interrupt); minimal UI (camera, talk button, spoken feedback).
- **Technical (30%):** Clear layers (React, Node, Gemini, Drive); **Grounding:** art metadata (artist, museum, date) is grounded via Google Search and/or Wikipedia in the Art Info Agent; Docent Agent uses confirmed info and does not fabricate facts; clean APIs and data model.
- **Demo (30%):** Happy path ~60–90 s: Login → Start visit → Capture 1–2 artworks → One voice question → End visit → Story. Optional “About / Architecture” in app.

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
- Backend Node/TS: all endpoints, Google Drive storage, Gemini (Live + text).
- React/TS frontend: LoginPage, VisitHome, LiveVisit, VisitSummary; camera + audio + basic styling.
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
- **Data:** Section 4 is the single source for Drive folder + index.json structure.
- **Order:** Implement flows in order 5.1 → 5.2 → 5.3 → 5.4; backend endpoints and frontend pages can be built in parallel per flow.
- **Two-agent artwork flow:** **Agent 1 (Art Info):** vision + Google Search/Wikipedia grounding → artist, museum, date, period, title → candidate for confirmation. **Agent 2 (Docent):** after user confirm or 5s timeout → visitor-friendly description and museum-docent presentation. Implement on `XLRyj` (Live Identification): show Art Info result, then confirm by voice (push-to-talk) or "Or type it myself"; if no response within 5s, treat as confirmed and call confirm endpoint. Support merge for duplicate photos of same artwork.
- **Live Agent:** One WebSocket per session; maintain context for sessionId; support interrupt (release Talk).
- **Screen ↔ Node mapping:** When implementing a screen, reference the Pencil node ID from §6.1 and the detailed flow in [implementation.md](implementation.md). Use `batch_get` with the node ID to inspect exact layout and properties.
