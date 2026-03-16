const STORAGE_KEY = "museeum_data";

export type Session = {
  id: string;
  museumName?: string;
  startedAt: string;
  endedAt?: string | null;
  status: "active" | "completed";
};

export type ArtInfoCandidate = {
  title: string;
  artist: string;
  museum?: string;
  year?: string;
  period?: string;
  confidence: "high" | "medium" | "low";
};

export type Artwork = {
  id: string;
  sessionId: string;
  createdAt: string;
  photos: string[];
  title: string;
  artist?: string;
  period?: string;
  year?: string;
  museumName?: string;
  explanationText?: string;
  sections?: Record<string, string>;
  tags?: string[];
  /** Optional 24kHz 16-bit LE mono PCM audio (base64) for the docent explanation. */
  explanationAudioPcmBase64?: string;
  confirmationSource?: "auto" | "voice" | "typed";
  liked?: boolean;
  confirmed: boolean;
  candidate?: ArtInfoCandidate;
};

export type SummarySection = {
  artworkTitle: string;
  artist?: string;
  shortStory: string;
};

export type Summary = {
  sessionId: string;
  summaryText: string;
  sections: SummarySection[];
  createdAt: string;
};

export type MuseeumData = {
  version: number;
  sessions: Session[];
  artworks: Artwork[];
  summaries: Summary[];
};

const defaultData: MuseeumData = {
  version: 1,
  sessions: [],
  artworks: [],
  summaries: [],
};

function load(): MuseeumData {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const parsed = JSON.parse(raw) as MuseeumData;
    return {
      version: parsed.version ?? 1,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      artworks: Array.isArray(parsed.artworks) ? parsed.artworks : [],
      summaries: Array.isArray(parsed.summaries) ? parsed.summaries : [],
    };
  } catch {
    return defaultData;
  }
}

function save(data: MuseeumData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save museeum_data", e);
  }
}

export function getMuseeumData(): MuseeumData {
  return load();
}

export function listSessions(): Session[] {
  return load().sessions;
}

export function getSession(sessionId: string): Session | undefined {
  return load().sessions.find((s) => s.id === sessionId);
}

export function addSession(session: Session): void {
  const data = load();
  if (data.sessions.some((s) => s.id === session.id)) return;
  data.sessions.push(session);
  save(data);
}

export function updateSession(sessionId: string, updates: Partial<Session>): void {
  const data = load();
  const i = data.sessions.findIndex((s) => s.id === sessionId);
  if (i === -1) return;
  data.sessions[i] = { ...data.sessions[i]!, ...updates };
  save(data);
}

export function getArtworksBySession(sessionId: string): Artwork[] {
  return load().artworks.filter((a) => a.sessionId === sessionId);
}

export function getArtwork(artworkId: string): Artwork | undefined {
  return load().artworks.find((a) => a.id === artworkId);
}

export function addArtwork(artwork: Artwork): void {
  const data = load();
  if (data.artworks.some((a) => a.id === artwork.id)) return;
  data.artworks.push(artwork);
  save(data);
}

export function updateArtwork(artworkId: string, updates: Partial<Artwork>): void {
  const data = load();
  const i = data.artworks.findIndex((a) => a.id === artworkId);
  if (i === -1) return;
  data.artworks[i] = { ...data.artworks[i]!, ...updates };
  save(data);
}

export function deleteArtwork(artworkId: string): void {
  const data = load();
  const nextArtworks = data.artworks.filter((a) => a.id !== artworkId);
  if (nextArtworks.length === data.artworks.length) return;
  data.artworks = nextArtworks;
  save(data);
}

export function getSummary(sessionId: string): Summary | undefined {
  return load().summaries.find((s) => s.sessionId === sessionId);
}

export function setSummary(summary: Summary): void {
  const data = load();
  const i = data.summaries.findIndex((s) => s.sessionId === summary.sessionId);
  if (i >= 0) data.summaries[i] = summary;
  else data.summaries.push(summary);
  save(data);
}

export function getFavoriteArtworks(): Artwork[] {
  return load().artworks.filter((a) => a.liked);
}

export function deleteSession(sessionId: string): void {
  const data = load();
  const nextSessions = data.sessions.filter((s) => s.id !== sessionId);
  if (nextSessions.length === data.sessions.length) return;
  data.sessions = nextSessions;
  data.artworks = data.artworks.filter((a) => a.sessionId !== sessionId);
  data.summaries = data.summaries.filter((s) => s.sessionId !== sessionId);
  save(data);
}
