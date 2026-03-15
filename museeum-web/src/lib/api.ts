const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const APP_ID = import.meta.env.VITE_MUSEEUM_APP_ID;

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (APP_ID) headers["X-Museeum-App-Id"] = APP_ID;
  return headers;
}

export async function createSession(accessCode?: string | null): Promise<{ sessionId: string }> {
  const headers = apiHeaders();
  const body: { accessCode?: string } = {};
  if (accessCode) body.accessCode = accessCode;
  const res = await fetch(`${API_BASE}/api/session`, {
    method: "POST",
    headers,
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error === "Invalid or missing access code" ? "Invalid or missing access code" : "Access denied");
  }
  if (res.status === 401) {
    throw new Error(
      "App id required. Set VITE_MUSEEUM_APP_ID in museeum-web/.env to match the backend MUSEEUM_APP_ID (see museeum-web/.env.example)."
    );
  }
  if (!res.ok) throw new Error(`Session failed: ${res.status}`);
  return res.json();
}
