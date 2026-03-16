# MuSeeum Web

React/TypeScript frontend for MuSeeum: AI museum companion with two-phase artwork identification (Art Info + Docent), Live Agent voice Q&A, and downloadable tour diary.

**Hackathon setup:** No login. Access code only (judge/organizer). Sessions, artworks, and photos are stored in **localStorage** in the browser.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`). For mobile testing, use the same machine’s LAN URL or a tunnel.

Set the API base URL if the backend is not on port 8080:

```bash
VITE_API_URL=http://localhost:3080 npm run dev
```

If the backend requires an app id (e.g. for deploy):

```bash
VITE_MUSEEUM_APP_ID=your-app-id npm run dev
```

## Usage

1. **Access code** — If the backend has `JUDGE_ACCESS_CODE` set, enter the code (or use the judge link with `?access=CODE`).
2. **Start Exploring** — From home, open the photo menu and choose **Take a Photo** or **Upload from Gallery**. A session is created on first capture.
3. **Live Identification** — After capture, the Art Info Agent (Gemini + grounding) suggests title, artist, museum. Confirm by voice, type, or wait 5 seconds. The Docent Agent then generates a description.
4. **Gallery** — View artworks per visit, like favorites, tap for full analysis.
5. **Talk to AI Guide** — From an artwork or the Live page, use the Live Agent (push-to-talk) for Q&A.
6. **End visit** — Generate a tour story and **Download as HTML** from the summary screen.

Data (sessions, artworks, photos as base64, summaries) is kept in the browser’s localStorage.

## With backend

Run [museeum-api](../museeum-api) with `GEMINI_API_KEY` set. The API provides: `POST /api/session`, `POST /api/session/:id/artwork`, `POST /api/session/:id/artwork/confirm`, `POST /api/session/:id/summary`, and `WS /api/live/:sessionId`.
