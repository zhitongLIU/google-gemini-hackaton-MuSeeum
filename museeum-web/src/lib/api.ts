const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const APP_ID = import.meta.env.VITE_MUSEEUM_APP_ID;

function apiHeaders(accessCode?: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (APP_ID) headers["X-Museeum-App-Id"] = APP_ID;
  if (accessCode) headers["X-Judge-Access-Code"] = accessCode;
  return headers;
}

function bodyWithAccessCode(accessCode?: string | null): { accessCode?: string } {
  return accessCode ? { accessCode } : {};
}

export async function createSession(accessCode?: string | null): Promise<{ sessionId: string }> {
  const res = await fetch(`${API_BASE}/api/session`, {
    method: "POST",
    headers: apiHeaders(accessCode),
    body: JSON.stringify(bodyWithAccessCode(accessCode)),
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

function normalizeErrorMessage(raw: string, status: number, fallback: string): string {
  let text = raw?.trim() || "";
  if (text) {
    // If backend sent HTML, strip tags and keep text content
    if (/<!doctype html>/i.test(text) || /<html/i.test(text)) {
      text = text.replace(/<br\s*\/?>/gi, "\n");
      text = text.replace(/<[^>]+>/gi, "");
    }
  }

  // Friendly message for oversized uploads
  if (
    /PayloadTooLargeError/i.test(text) ||
    /request entity too large/i.test(text) ||
    status === 413
  ) {
    return "This photo is too large for MuSeeum to analyze. Try taking a new photo or uploading a smaller/cropped version, then try again.";
  }

  return text || fallback;
}

export type ArtInfoCandidate = {
  title: string;
  artist: string;
  museum?: string;
  year?: string;
  period?: string;
  confidence: "high" | "medium" | "low";
};

export async function postArtwork(
  sessionId: string,
  imageBase64: string,
  accessCode?: string | null
): Promise<{ tempId: string; candidate: ArtInfoCandidate }> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}/artwork`, {
    method: "POST",
    headers: apiHeaders(accessCode),
    body: JSON.stringify({ image: imageBase64, ...bodyWithAccessCode(accessCode) }),
  });
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Access denied");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(normalizeErrorMessage(err, res.status, `Artwork failed: ${res.status}`));
  }
  return res.json();
}

export type ConfirmArtworkPayload = {
  title: string;
  artist?: string;
  period?: string;
  year?: string;
  museumName?: string;
  correctedTitle?: string;
};

export type ConfirmArtworkResult = {
  artworkId: string;
  title: string;
  artist: string;
  explanationText: string;
  sections?: Record<string, string>;
  tags?: string[];
  /** Optional 24kHz 16-bit LE mono PCM audio (base64) for the docent explanation. */
  audioPcmBase64?: string;
};

export async function confirmArtwork(
  sessionId: string,
  payload: ConfirmArtworkPayload,
  accessCode?: string | null
): Promise<ConfirmArtworkResult> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}/artwork/confirm`, {
    method: "POST",
    headers: apiHeaders(accessCode),
    body: JSON.stringify({ ...payload, ...bodyWithAccessCode(accessCode) }),
  });
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Access denied");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(normalizeErrorMessage(err, res.status, `Confirm failed: ${res.status}`));
  }
  return res.json();
}

export type SummaryResult = {
  summaryText: string;
  sections: Array<{ artworkTitle: string; artist?: string; shortStory: string }>;
};

export async function postSummary(
  sessionId: string,
  artworks: Array<{ title: string; artist?: string; explanationText?: string }>,
  accessCode?: string | null
): Promise<SummaryResult> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}/summary`, {
    method: "POST",
    headers: apiHeaders(accessCode),
    body: JSON.stringify({ artworks, ...bodyWithAccessCode(accessCode) }),
  });
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Access denied");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(normalizeErrorMessage(err, res.status, `Summary failed: ${res.status}`));
  }
  return res.json();
}
