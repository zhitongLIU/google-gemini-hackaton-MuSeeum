# MuSeeum Web

MVP frontend: mobile-first camera, push-to-talk, and Live Agent descriptions.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL shown (e.g. `http://localhost:5173`). For mobile testing, use the same machine’s LAN URL or tunnel (e.g. ngrok).

Set the API base URL if the backend is not on port 8080:

```bash
VITE_API_URL=http://localhost:3080 npm run dev
```

## Usage

1. Allow camera and microphone when prompted.
2. **Describe this** — capture a frame and send it to the Live Agent for a description.
3. **Talk** — hold the button to record; release to send. The agent replies with text (and optionally audio).

The backend must be running and `GEMINI_API_KEY` set for the Live Agent to respond.
