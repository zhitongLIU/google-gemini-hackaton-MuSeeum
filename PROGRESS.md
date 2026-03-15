# MuSeeum — Implementation Progress

## ✅ Done

### Backend (`museeum-api/`)

- [x] Project scaffold: `package.json`, `tsconfig.json`, `Dockerfile`, `.env.example`, `.gitignore`
- [x] **Config**: Google Drive storage layer (`lib/driveStore.ts`), Gemini AI client + system instruction (`config/gemini.ts`)
- [x] **Middleware**: Google OAuth access token verification (`middleware/auth.ts` + `lib/googleAuth.ts`)
- [x] **Prompts**: Artwork identification, explanation, and story-generation prompt templates (`prompts/index.ts`)
- [x] **Routes — Sessions** (`routes/sessions.ts`): POST create, GET list, GET detail (with artworks + summary), PATCH update — stored in Drive `index.json`
- [x] **Routes — Artwork** (`routes/artwork.ts`): POST identify (Gemini Vision), POST confirm (explanation generation), POST photos, PATCH like/notes — images saved to Drive folders
- [x] **Routes — Summary** (`routes/summary.ts`): POST generate story via Gemini from session artworks — stored in Drive index
- [x] **Routes — Live** (`routes/live.ts`): WebSocket server for Live Q&A with auth, artwork context injection, text fallback (audio stubbed) using Drive-backed session data
- [x] **Entry point** (`index.ts`): Express app with CORS, JSON body parsing, route mounting, HTTP+WS server
- [x] `npm install` — all dependencies installed
- [x] `tsc --noEmit` — zero TypeScript errors
- [x] `tsc` build — compiles to `dist/`

### Frontend (`museeum-web/`)

- [x] Project scaffold: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.env.example`, `.gitignore`
- [x] **Styling** (`index.css`): Tailwind v4 `@theme` with gold design tokens, Inter + serif fonts, 390×844 mobile viewport
- [x] **Lib**: API fetch wrapper with Drive auth + guest fallback (`lib/api.ts`), guest local storage store (`lib/localStore.ts`), camera/gallery utils (`lib/camera.ts`)
- [x] **Context**: `AuthContext.tsx` — Google Identity Services token flow, sessionStorage + cookie flags, `useAuth()` hook
- [x] **Router** (`App.tsx`): Routes accessible without sign-in (guest mode), `main.tsx` with QueryClient + BrowserRouter + AuthProvider
- [x] **Shared components**: BottomNav (4 tabs), BottomSheet (animated overlay), StatusBar, PhotoMenu (camera/upload sheet), MuseumPicker (search + preset list)
- [x] **Pages** (11 total):
  - `LoginPage` — Google sign-in + Continue as Guest
  - `VisitHome` — empty state + visit card carousel + discovery menu
  - `LiveIdentification` — dark immersive, AI identification, waveform, push-to-talk mic, text fallback, confirm flow
  - `ArtworkAnalysis` — photo slider, metadata, tags, period, description, like, "Talk to AI Guide" CTA
  - `MuseumGalleryGrid` — 3-column grid, heart badges, unconfirmed indicators, FAB camera
  - `PhotoViewer` — full-screen dark, pagination dots, notes editing
  - `EditMuseum` — search/select museum, current museum highlight
  - `CollectionStats` — stat cards, artworks-per-museum bar chart, art periods, top artists
  - `FavoriteArtworks` — grid of liked artworks across museums
  - `VisitSummary` — AI story generation, intro/sections/closing display
  - `StubPage` — placeholder for Discover, Map, Profile tabs
- [x] `npm install` — all dependencies installed
- [x] `tsc --noEmit` — zero TypeScript errors
- [x] `vite build` — production bundle (486 KB / 131 KB gzip)

---

## 🔜 To Do Next

### Phase 1 — Auth & Sessions (end-to-end wiring)

- [x] Create `.env` files with Google OAuth Client ID + Gemini API credentials
- [ ] Start both dev servers (`npm run dev`) and verify they boot + proxy
- [x] Test Google Sign-In flow (token → Drive access) and guest mode (sessionStorage + cookie)
- [ ] Test session CRUD (create visit → list visits → view detail)

### Phase 2 — Capture Flow

- [ ] Test camera capture → upload → Gemini Vision identification
- [ ] Test Live Identification confirm/reject → artwork creation
- [ ] Test text-input fallback for artwork title correction
- [x] Wire MuseumPicker session creation + navigate to live screen
- [x] 5s auto-confirm on Live Identification; museum in candidate + UI

### Phase 3 — Gallery & Detail

- [ ] Test gallery grid rendering with real artwork data
- [ ] Test artwork detail page with photo slider + like toggle
- [ ] Test PhotoViewer navigation + note editing
- [x] EditMuseum → PATCH session (museum name) wired
- [x] Golden frame (FramedArtwork) on LiveIdentification, ArtworkAnalysis, PhotoViewer, Gallery, Favorites

### Phase 4 — AI Features

- [x] Gemini Live API bidirectional audio (genai.live.connect, sendRealtimeInput, stream transcript/audio)
- [ ] Test "Talk to AI Guide" → WebSocket live session
- [x] Visit Summary → AI story generation + display; summary sections include narrative

### Phase 5 — Secondary Screens

- [ ] Wire CollectionStats with real aggregated data
- [ ] Wire FavoriteArtworks across all sessions
- [x] Diary export: Download as HTML (framed images) and PDF (jsPDF); wired on VisitSummary

### Phase 6 — Polish & Deploy

- [x] Add `@keyframes slide-up` animation for BottomSheet
- [x] Error boundary (ErrorBoundary) wrapping App
- [ ] Toast notifications for API errors (optional)
- [x] Loading skeletons (SessionListSkeleton, ArtworkDetailSkeleton)
- [ ] Cloud Run deployment (backend Dockerfile ready)
- [ ] Vercel (or any static host) deployment (frontend)
- [x] README.md (museeum-api, museeum-web) with setup instructions
- [x] ARCHITECTURE.md with system diagram
