# Agent App Architecture Guide (Based on Way Back Home)

This document describes how to structure a **new agent application** using [Way Back Home](https://github.com/google-gemini/way-back-home) as the reference. Follow this layout and these patterns so frontend, backend, and agents communicate clearly and deploy cleanly on Google Cloud.

---

## 1. Purpose

- **Single reference:** Way Back Home (`way-back-home/`) is the canonical example.
- **Audience:** Teams building a new app that combines a web UI, a backend API, and one or more AI agents (e.g. Gemini/ADK).
- **Outcome:** A consistent structure where the frontend never talks to agents directly, the backend is the source of truth, and agents get context from the backend and write back via tools or API calls.

---

## 2. Recommended Directory Layout

Mirror the Way Back Home layout. Not every app needs every folder; omit what you don’t use.

```
your-agent-app/
├── dashboard/                    # User-facing app
│   ├── frontend/                # Web UI (Next.js, React, etc.)
│   │   ├── app/ or src/
│   │   ├── lib/api.ts           # Single API client; one base URL
│   │   ├── package.json
│   │   ├── Dockerfile           # Multi-stage if framework supports it
│   │   └── .env.example          # NEXT_PUBLIC_API_URL or equivalent
│   │
│   └── backend/                 # REST API + persistence
│       ├── app/
│       │   ├── main.py or main.ts
│       │   ├── config.py        # Env-based config (no secrets in code)
│       │   ├── routes/          # Events, participants, health, admin…
│       │   ├── models/
│       │   ├── database.py      # Firestore, SQL, etc.
│       │   └── storage.py       # Cloud Storage, Drive, etc.
│       ├── requirements.txt or package.json
│       ├── Dockerfile           # Single stage: install → run server
│       └── .env.template       # GOOGLE_CLOUD_PROJECT, API_BASE_URL, …
│
├── solutions/                   # Agent and automation code
│   ├── level_0/                 # One-off or setup scripts (e.g. avatar generator)
│   │   └── generator.py        # No long-running service; reads config/env
│   │
│   └── level_1/                # First “level” of agent logic
│       ├── agent/              # ADK (or similar) agent(s)
│       │   ├── agent.py        # Root orchestrator; before_agent_callback
│       │   ├── agents/         # Sub-agents (e.g. geological_analyst.py)
│       │   ├── tools/          # confirm_tools, mcp_tools, …
│       │   ├── requirements.txt
│       │   └── (Dockerfile if deployed as separate service)
│       │
│       └── mcp-server/          # Optional: custom MCP server for tools
│           ├── main.py          # FastMCP, @mcp.tool(), HTTP transport
│           ├── Dockerfile
│           └── cloudbuild.yaml # Build + push + deploy to Cloud Run
│
└── workshop.config.json        # Optional: API_BASE_URL, MAP_BASE_URL, event codes
```

**When to deviate:**

- **No “level_0”:** If you have no setup script, omit `solutions/level_0`.
- **No MCP server:** If all tools are in-process or you use only Google-hosted MCP, omit `solutions/level_1/mcp-server`.
- **Agents inside backend:** For request-scoped agents (e.g. “on each HTTP request”), run agent code inside the backend process and skip a separate `solutions/level_1/agent` service; keep the **communication rules** below the same.

---

## 3. Communication Rules

These rules are what make the architecture predictable and deployable.

### 3.1 Frontend → Backend only

- The frontend has **one** API base URL (e.g. `NEXT_PUBLIC_API_URL` or `API_BASE_URL`).
- All data and actions go through the backend: REST and, if needed, WebSocket to the **same** backend origin.
- The frontend must **never** call an agent URL, Gemini API, or MCP server directly. No agent or AI keys in the client.

**Way Back Home:** `dashboard/frontend/lib/api.ts` uses `API_BASE_URL` for all requests; no other base URLs.

### 3.2 Backend = source of truth

- The backend owns persistence: database (Firestore, SQL, etc.) and object storage (Cloud Storage, Drive, etc.).
- It exposes a stable REST (and optionally WebSocket) API. Other components (agents, scripts) read and write state **through** the backend API or SDK, not by touching the database from multiple places.
- Document the API (e.g. OpenAPI or a short table in README) so agent and frontend developers know the contract.

**Way Back Home:** Backend exposes `GET /participants/:id` (with `evidence_urls`), `PATCH /participants/:id/location`, etc. Agent and evidence-upload scripts use these endpoints.

### 3.3 Agent gets context from the backend

- Agents should **not** rely on config files or hardcoded participant/session data. They should get context at runtime from the backend.
- **Pattern:** Use a **before_agent_callback** (or equivalent) that:
  1. Reads an identifier from the environment (e.g. `PARTICIPANT_ID`, `SESSION_ID`) and `BACKEND_URL`.
  2. Calls the backend (e.g. `GET /participants/:id` or `GET /session/:id`).
  3. Writes the response into the agent’s **state** (e.g. `callback_context.state["soil_url"] = ...`).
- Sub-agents use **state templating** (e.g. `{soil_url}` in the instruction) so they receive the same context without extra config.

**Way Back Home:** `solutions/level_1/agent/agent.py` uses `setup_participant_context` as `before_agent_callback`: fetches participant, sets `soil_url`, `flora_url`, `stars_url`, `x`, `y`, etc. Sub-agents reference `{soil_url}` and the like in their instructions.

### 3.4 Agent writes back via tools

- When the agent must update backend state (e.g. “confirm location”, “save artwork”), it does so by calling the **backend API** from a **tool**, not by writing to the DB from the agent process.
- The tool receives a **ToolContext** (or equivalent) so it can read `backend_url` and entity IDs from state (set by the callback). It then performs an HTTP call (e.g. `PATCH /participants/:id/location`).
- This keeps auth, validation, and business rules in one place (the backend).

**Way Back Home:** `solutions/level_1/agent/tools/confirm_tools.py` implements `confirm_location`: reads `participant_id`, `backend_url`, `x`, `y` from `tool_context.state`, then calls `PATCH {backend_url}/participants/{participant_id}/location`.

### 3.5 Optional: MCP server for heavy or shared tools

- If you have tools that are heavy (e.g. vision/multimodal) or shared across agents, run them in a **separate MCP server** (e.g. FastMCP) and deploy it to Cloud Run.
- The agent connects to the MCP server over **HTTP** (Streamable HTTP). Set the server URL via env (e.g. `MCP_SERVER_URL`).
- The MCP server should be stateless and use the same GCP project/location as the rest of the app (e.g. for Vertex AI).

**Way Back Home:** `solutions/level_1/mcp-server` exposes `analyze_geological` and `analyze_botanical`; agent uses `StreamableHTTPConnectionParams` with `MCP_SERVER_URL` in `agent/tools/mcp_tools.py`.

---

## 4. Component Responsibilities (Summary)

| Component        | Owns                                                                 | Talks to                          |
|-----------------|----------------------------------------------------------------------|-----------------------------------|
| **Frontend**    | UI, client state, forms, camera/mic, single API client               | Backend only (REST + optional WS) |
| **Backend**     | Auth, API, persistence, business rules, optional in-process agents   | Frontend, DB, storage, Gemini, optional MCP |
| **Agent**       | Orchestration, sub-agents, tools, callback to load context           | Backend (HTTP), optional MCP server |
| **MCP server**  | Stateless tools (e.g. vision, multimodal)                            | Called by agent(s); uses Gemini/GCP |

---

## 5. Configuration and environment

- **Backend:**  
  - `GOOGLE_CLOUD_PROJECT`, `API_BASE_URL`, `MAP_BASE_URL` (or app-specific URLs).  
  - DB and storage config (credentials via ADC or env).  
  - CORS allowlist derived from frontend URL(s).
- **Frontend:**  
  - Build-time: `NEXT_PUBLIC_API_URL` (or equivalent) pointing at the backend.  
  - No Gemini or agent URLs; no server-side secrets in client bundle.
- **Agent (when run as a separate service):**  
  - `PARTICIPANT_ID` (or equivalent), `BACKEND_URL`, `PUBLIC_URL` (for A2A if used).  
  - `MCP_SERVER_URL` if using a custom MCP server.  
  - `GOOGLE_CLOUD_PROJECT` for Vertex/Gemini.
- **MCP server:**  
  - `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`.  
  - `PORT` (Cloud Run sets this).

Provide `.env.example` / `.env.template` in each component and document every variable in the repo README.

---

## 6. Deployment on Google Cloud

- **Backend:** Dockerfile → build image → push to Artifact Registry → deploy to **Cloud Run**. Use `PORT` from the environment; expose a health check (e.g. `/health`). Set env vars (and secrets if needed) in the service.
- **Frontend:** Multi-stage Dockerfile (deps → build → standalone or static) → deploy to **Cloud Run** (Node server) or to **Firebase Hosting / Vercel** (static). Set build args so the client gets the correct `NEXT_PUBLIC_API_URL`.
- **Agent (if separate):** Same pattern: Dockerfile → Cloud Run. If using A2A, run `to_a2a(root_agent, ...)` and set `PUBLIC_URL` to the Cloud Run URL. Pass `BACKEND_URL`, `PARTICIPANT_ID` (or equivalent), and `MCP_SERVER_URL` via env.
- **MCP server:** Dockerfile + **Cloud Build** (`cloudbuild.yaml`): build → push → deploy to Cloud Run. Use `--allow-unauthenticated` if only your backend/agent call it and you secure by network or IAM.

Use **substitutions** in Cloud Build for project, region, and repo name so one file works across environments.

---

## 7. When to use which pattern

| Scenario | Recommendation |
|----------|----------------|
| Agent runs **per HTTP request** (e.g. “analyze this image”) | Run agent code **inside the backend**. No separate agent service; backend receives request, calls Gemini/agent, returns response. |
| Agent runs **asynchronously** or is **invoked by another system** (e.g. workshop step with `PARTICIPANT_ID`) | Run agent as a **separate Cloud Run service**; use **before_agent_callback** to load context from backend and **tools** to write back. Optionally expose via **A2A** if other agents need to call it. |
| Heavy or shared tools (vision, multimodal, custom logic) | Put them in an **MCP server** (e.g. FastMCP, HTTP transport) and deploy to Cloud Run; agent connects with `MCP_SERVER_URL`. |
| Simple tools that only call the backend | Implement as **in-process tools** (e.g. ADK `FunctionTool`) that take `ToolContext` and call `BACKEND_URL` over HTTP. |

---

## 8. New-project checklist

Use this when starting a new agent app:

- [ ] Create `dashboard/frontend` and `dashboard/backend` with a single API base URL in the client and env-based config in the backend.
- [ ] Define backend routes and persistence so the backend is the only writer to the database and storage.
- [ ] If you have an agent, decide: in-process (inside backend) vs separate service. If separate, add `solutions/level_1/agent` and use a **before_agent_callback** to load context from the backend and **tools** to update the backend.
- [ ] If you need custom MCP tools, add `solutions/level_1/mcp-server`, use FastMCP with HTTP transport, and connect from the agent with `MCP_SERVER_URL`.
- [ ] Add Dockerfiles for backend and frontend (and for agent and MCP server if used). Add `.env.example` / `.env.template` and document env vars in README.
- [ ] Configure deployment (Cloud Build or GitHub Actions): build → push → deploy to Cloud Run (or static host for frontend). Set all required env vars and, if needed, secrets.
- [ ] Verify: frontend only talks to backend; agent (if any) gets context from backend and writes back via tools; no agent or Gemini URLs in the frontend.

---

## 9. Reference: Way Back Home paths

| Concern | Path in way-back-home |
|--------|------------------------|
| Frontend API client | `dashboard/frontend/lib/api.ts` |
| Backend app and config | `dashboard/backend/app/main.py`, `config.py` |
| Backend participant routes | `dashboard/backend/app/routes/participants.py` |
| Agent callback + root agent | `solutions/level_1/agent/agent.py` |
| Tool that calls backend | `solutions/level_1/agent/tools/confirm_tools.py` |
| MCP connection from agent | `solutions/level_1/agent/tools/mcp_tools.py` |
| Sub-agent with state templating | `solutions/level_1/agent/agents/geological_analyst.py` |
| MCP server (FastMCP, HTTP) | `solutions/level_1/mcp-server/main.py` |
| MCP server deploy | `solutions/level_1/mcp-server/cloudbuild.yaml` |
| Backend Dockerfile | `dashboard/backend/Dockerfile` |
| Frontend Dockerfile | `dashboard/frontend/Dockerfile` |

Using this layout and these communication rules will keep your agent app consistent with Way Back Home and easy to deploy on Google Cloud.
