import { Router } from "express";
import { randomUUID } from "crypto";
import { runArtInfoAgent } from "../agents/art-info-agent.js";
import { runDocentAgent } from "../agents/docent-agent.js";
import { requireAccessCode } from "../middleware/access-code.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";

export const artworkRouter = Router();

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY ?? null;
}

/** POST /api/session/:id/artwork — Art Info Agent, returns candidate */
artworkRouter.post(
  "/session/:id/artwork",
  requireAccessCode,
  async (req, res) => {
    const sessionId = req.params.id as string;
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      res.status(400).json({ error: "Invalid session id" });
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      res.status(503).json({ error: "GEMINI_API_KEY not configured" });
      return;
    }
    let imageBase64: string;
    const body = req.body as { image?: string; imageBase64?: string };
    if (body?.image) {
      imageBase64 = body.image.replace(/^data:image\/\w+;base64,/, "");
    } else if (body?.imageBase64) {
      imageBase64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    } else {
      res.status(400).json({ error: "Missing image or imageBase64 in body" });
      return;
    }
    try {
      const { candidate } = await runArtInfoAgent(apiKey, imageBase64, "image/jpeg");
      const tempId = randomUUID();
      res.json({ tempId, candidate });
    } catch (err) {
      console.error("[Art Info Agent]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Art info failed",
      });
    }
  }
);

/** POST /api/session/:id/artwork/confirm — Docent Agent, returns explanation */
artworkRouter.post(
  "/session/:id/artwork/confirm",
  requireAccessCode,
  async (req, res) => {
    const sessionId = req.params.id as string;
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      res.status(400).json({ error: "Invalid session id" });
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      res.status(503).json({ error: "GEMINI_API_KEY not configured" });
      return;
    }
    const body = req.body as {
      title: string;
      artist?: string;
      period?: string;
      year?: string;
      museumName?: string;
      correctedTitle?: string;
    };
    const title = body?.correctedTitle ?? body?.title ?? "Unknown artwork";
    if (!title.trim()) {
      res.status(400).json({ error: "Missing title or correctedTitle" });
      return;
    }
    const artworkId = randomUUID();
    try {
      const result = await runDocentAgent(
        apiKey,
        {
          title: title.trim(),
          artist: body?.artist?.trim(),
          period: body?.period?.trim(),
          year: body?.year != null ? String(body.year) : undefined,
          museumName: body?.museumName?.trim(),
        },
        artworkId
      );
      res.json(result);
    } catch (err) {
      console.error("[Docent Agent]", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Docent failed",
      });
    }
  }
);

/** POST /api/session/:id/summary — Generate tour story from artworks (stateless) */
artworkRouter.post("/session/:id/summary", requireAccessCode, async (req, res) => {
  const sessionId = req.params.id as string;
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({ error: "GEMINI_API_KEY not configured" });
    return;
  }
  const body = req.body as { artworks?: Array<{ title: string; artist?: string; explanationText?: string }> };
  const artworks = Array.isArray(body?.artworks) ? body.artworks : [];

  const url = `${GEMINI_BASE}/models/${DEFAULT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = `You are a friendly museum docent. Write a short, personalized tour story (2–4 paragraphs) based on the following artworks the visitor saw. Include:
1. A brief intro (one sentence).
2. For each artwork: title, artist, and a 1–2 sentence story or highlight.
3. A closing sentence.

Artworks:
${artworks.length === 0 ? "No artworks listed." : artworks.map((a, i) => `${i + 1}. "${a.title}" by ${a.artist ?? "Unknown"}${a.explanationText ? ` — ${a.explanationText.slice(0, 120)}...` : ""}`).join("\n")}

Reply with the story only. Then on a new line write "---SECTIONS---" and then a JSON array of objects: [{ "artworkTitle": "...", "artist": "...", "shortStory": "..." }] one per artwork.`;

  try {
    const fetchRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    });
    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      throw new Error(`${fetchRes.status} ${errText}`);
    }
    const data = (await fetchRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? "";
    const [storyPart, sectionsPart] = text.split("---SECTIONS---").map((s) => s.trim());
    let sections: Array<{ artworkTitle: string; artist?: string; shortStory: string }> = [];
    if (sectionsPart) {
      try {
        const parsed = JSON.parse(sectionsPart) as Array<{ artworkTitle?: string; artist?: string; shortStory?: string }>;
        if (Array.isArray(parsed)) {
          sections = parsed.map((s) => ({
            artworkTitle: s.artworkTitle ?? "Unknown",
            artist: s.artist,
            shortStory: s.shortStory ?? "",
          }));
        }
      } catch {
        // ignore parse error
      }
    }
    if (artworks.length > 0 && sections.length === 0) {
      sections = artworks.map((a) => ({
        artworkTitle: a.title,
        artist: a.artist,
        shortStory: (a.explanationText ?? "").slice(0, 200),
      }));
    }
    res.json({ summaryText: storyPart || text, sections });
  } catch (err) {
    console.error("[Summary]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Summary failed",
    });
  }
});
