# MuSeeum MVP — Mobile Camera + Live Agent Description

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Minimalist implementation where the user uses the mobile camera and a Live Agent AI responds with descriptions (voice + optional vision). No full two-phase artwork flow, no Drive persistence, no diary export — only: session, camera, push-to-talk, Gemini Live, and spoken/text description.

**Architecture:** Frontend (React/TS, mobile-first) captures camera and streams microphone to the backend over a single WebSocket. Backend (Node/TS, Express) creates an ephemeral session (in-memory or minimal store), exposes `WS /api/live/:sessionId`, and bridges the client to Gemini Live API. The Live Agent receives audio (and optionally a camera frame when the user requests “describe this”) and responds with a museum-docent-style description; responses are streamed back as text and audio. All traffic is frontend → backend only; no direct Gemini calls from the client.

**Tech Stack:** React, TypeScript, Vite, Tailwind (frontend); Node.js, Express, TypeScript (backend); Gemini Live API / GenAI SDK; `getUserMedia` for camera + mic; WebSocket (native or socket.io).

---

## Scope: In / Out

| In scope (MVP) | Out of scope (post-MVP) |
|----------------|-------------------------|
| Mobile-first camera view | Full two-phase Art Info + Docent flow |
| Create session → get `sessionId` | Google Drive `index.json` and visit folders |
| WebSocket `WS /api/live/:sessionId` | Artwork capture → confirm → explanation screens |
| Push-to-talk → stream mic → Live Agent reply (voice + text) | End visit → summary → downloadable diary (HTML/PDF) |
| Optional: send one camera frame for “Describe this” (vision) | Google Sign-In / Drive scope (guest-only OK for MVP) |
| Docent persona in Live Agent system prompt | `POST /session/:id/artwork`, confirm, photos, summary endpoints |

---

## High-Level Data Flow

1. User opens app on mobile → frontend creates session `POST /api/session` → receives `sessionId`.
2. Frontend opens WebSocket to `WS /api/live/:sessionId` (no auth for MVP guest mode).
3. User sees camera view; holds “Talk” → frontend streams mic audio to backend → backend forwards to Gemini Live.
4. Backend streams Live Agent response (text + audio) back to frontend; UI shows transcript and plays audio.
5. Optional: “Describe this” button captures one frame from camera, sends as image to backend; backend sends to Gemini Live (vision) and agent responds with description.

---

## Task 1: Backend — Project and session

**Files:**
- Create: `museeum-api/package.json`
- Create: `museeum-api/tsconfig.json`
- Create: `museeum-api/src/index.ts`
- Create: `museeum-api/src/routes/session.ts`
- Create: `museeum-api/.env.example`

**Step 1: Bootstrap Node/TS backend**

- Create `museeum-api` with `package.json` (express, typescript, ts-node-dev, @types/express, dotenv).
- Add `tsconfig.json` with `"outDir": "dist"`, `"rootDir": "src"`.
- Add script: `"dev": "ts-node-dev --respawn src/index.ts"`.

**Step 2: Express app and session route**

- In `src/index.ts`: create Express app, `express.json()`, CORS allow `*` for MVP, mount `/api` if desired (e.g. `app.use('/api', apiRouter)`).
- Health: `GET /health` → `{ status: 'ok' }`.
- Session store: in-memory `Map<string, { id: string, createdAt: number }>`.
- `POST /api/session`: generate UUID `sessionId`, store in map, return `{ sessionId }`. No body required for MVP.

**Step 3: Run and verify**

- Run: `cd museeum-api && npm run dev`
- Curl: `curl -X POST http://localhost:PORT/api/session` → `{ "sessionId": "..." }`.
- Commit: `feat(api): add session creation endpoint`.

---

## Task 2: Backend — Gemini Live WebSocket bridge

**Files:**
- Create: `museeum-api/src/live/gemini-live.ts` (or `src/routes/live.ts`)
- Modify: `museeum-api/src/index.ts` (mount WebSocket or live route)

**Step 1: Dependencies and env**

- Add to backend: `@google/genai` (or SDK used for Live API), `ws` and `@types/ws`. Add `GEMINI_API_KEY` to `.env.example`.

**Step 2: WebSocket server for `/api/live/:sessionId`**

- Use `express-ws` or a raw `http` + `ws` server so that `WS /api/live/:sessionId` is available.
- On connection: parse `sessionId` from path; validate session exists in memory store (optional for MVP).
- Create or reuse a Gemini Live client for this `sessionId` (in-memory map by sessionId). System prompt: museum docent persona — friendly, knowledgeable, describes what they see/hear; for MVP focus on “describe what you see” when given an image and answer questions when given only audio.

**Step 3: Bridge client ↔ Gemini Live**

- Receive binary or base64 audio from client (e.g. in WebSocket messages); forward to Gemini Live as input.
- Optional: accept a JSON message with `image: base64` (one frame) and send to Gemini as vision input so agent can “describe this.”
- Stream Gemini Live output (text and/or audio) back over the same WebSocket (e.g. JSON like `{ type: 'text', data }` and `{ type: 'audio', data: base64 }`).
- On client disconnect: close Gemini Live session and clean up.

**Step 4: Verify**

- Use a simple test client (e.g. Node script with `ws`) to open `WS /api/live/:sessionId`, send a short audio chunk (or image), and log responses.
- Commit: `feat(api): add Gemini Live WebSocket bridge`.

---

## Task 3: Frontend — Project and mobile camera

**Files:**
- Create: `museeum-web/package.json`
- Create: `museeum-web/tsconfig.json`
- Create: `museeum-web/vite.config.ts`
- Create: `museeum-web/index.html`
- Create: `museeum-web/src/main.tsx`
- Create: `museeum-web/src/App.tsx`
- Create: `museeum-web/src/components/CameraView.tsx`

**Step 1: Bootstrap React/TS frontend**

- Vite + React + TypeScript; Tailwind CSS. Add script `dev` and `build`.
- `index.html` → root div; `main.tsx` renders `App` into root.

**Step 2: Camera view (mobile-first)**

- `CameraView`: use `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` (video for camera, audio for push-to-talk). Render `<video ref={videoRef} autoPlay playsInline muted />` and attach the video stream. Use CSS so the camera fills the screen on mobile (e.g. object-fit cover, full viewport).
- Handle errors (no permission, no device); show a short message and retry button.
- Expose a way to capture a single frame (e.g. `canvas.getContext('2d').drawImage(video, 0, 0); canvas.toDataURL('image/jpeg', 0.8)`). Optional for MVP: “Describe this” button that uses this.

**Step 3: Verify**

- Run frontend on dev server; open on a real device or Chrome mobile emulation; allow camera/mic; confirm camera view fills screen.
- Commit: `feat(web): add mobile-first camera view`.

---

## Task 4: Frontend — Session and Live WebSocket

**Files:**
- Create: `museeum-web/src/lib/api.ts`
- Create: `museeum-web/src/hooks/useLiveSession.ts` (or `useLiveAgent.ts`)
- Modify: `museeum-web/src/App.tsx`

**Step 1: API client**

- `api.ts`: base URL from `import.meta.env.VITE_API_URL` (e.g. `http://localhost:PORT`). Function `createSession(): Promise<{ sessionId: string }>` → `POST ${base}/api/session`.

**Step 2: Live WebSocket hook**

- `useLiveSession(sessionId)` (or no sessionId and create inside hook): when `sessionId` is set, open WebSocket to `ws://.../api/live/${sessionId}` (or wss in prod).
- Send: binary audio chunks (from MediaRecorder or AudioWorklet) while “Talk” is held; optionally send one JSON message `{ type: 'image', data: base64 }` when user taps “Describe this.”
- Receive: parse messages (text vs audio); expose `transcript` (string) and `audioChunks` or a single `audioUrl` for playback. For MVP, at least show transcript; optional: play back audio with `new Audio(audioUrl)` or MediaSource.
- Cleanup: close WebSocket on unmount or when sessionId changes.

**Step 3: Integrate in App**

- On mount: call `createSession()`, set `sessionId` in state.
- Render `CameraView` and a “Talk” button (push-to-talk). While pressed: capture mic via MediaRecorder, send chunks to WebSocket. Show “Listening…” or waveform when active.
- Show agent response: transcript below or overlaid; optional audio playback.
- Optional: “Describe this” button that captures one frame from `CameraView` and sends it over the WebSocket.

**Step 4: Verify**

- Start backend and frontend; create session; open Live WebSocket; hold Talk and speak; confirm transcript (and audio if implemented) from Live Agent.
- Commit: `feat(web): session + Live WebSocket + push-to-talk`.

---

## Task 5: End-to-end and docs

**Files:**
- Create: `museeum-api/README.md`
- Create: `museeum-web/README.md`
- Optional: `ARCHITECTURE.md` update or a one-paragraph MVP section

**Step 1: READMEs**

- Backend README: how to run `npm install`, `npm run dev`; env vars (`GEMINI_API_KEY`, `PORT`); example `POST /api/session` and `WS /api/live/:sessionId`.
- Frontend README: how to run with `VITE_API_URL=http://localhost:PORT`; that the app uses mobile camera and push-to-talk and the Live Agent responds with descriptions.

**Step 2: Architecture note**

- In `ARCHITECTURE.md` or a short `docs/mvp-scope.md`: state that the MVP is camera + Live Agent only; full two-phase flow, Drive, and diary are post-MVP.

**Step 3: E2E check**

- From a phone or mobile emulator: open app → allow camera/mic → tap Talk → ask “What do you see?” (if no image sent) or tap “Describe this” then Talk → confirm Live Agent responds with a description (voice/text).
- Commit: `docs: README and MVP scope`.

---

## Execution Order Summary

| Order | Task | Delivers |
|-------|------|----------|
| 1 | Backend — Project and session | `POST /api/session` → `sessionId`, in-memory store |
| 2 | Backend — Gemini Live WebSocket bridge | `WS /api/live/:sessionId` ↔ Gemini Live (audio ± image) |
| 3 | Frontend — Project and mobile camera | React app, full-screen camera on mobile |
| 4 | Frontend — Session and Live WebSocket | Create session, push-to-talk, show agent transcript (± audio) |
| 5 | E2E and docs | READMEs, MVP scope note, manual E2E pass |

---

## References

- **PRD:** `prd.md` — §2 Architecture, §3 API (session + Live), §5.3 Live Q&A, §6 LiveVisit.
- **Architecture:** `ARCHITECTURE.md` — diagram and data flow; MVP uses only session + Live Route.
- **Agent guide:** `docs/agent-app-architecture-guide.md` — frontend → backend only; backend owns Gemini.

---

Plan complete and saved to `mvp_plan.md`. Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Parallel Session (separate)** — Open a new session with executing-plans and run through the plan with checkpoints.

Which approach do you prefer?
