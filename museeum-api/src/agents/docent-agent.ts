/**
 * Docent Agent: Gemini text generation for visitor-friendly artwork description.
 * Uses confirmed art metadata (no grounding); returns explanationText, sections, tags.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";

export type DocentPayload = {
  title: string;
  artist?: string;
  period?: string;
  year?: string;
  museumName?: string;
};

export type DocentResult = {
  artworkId: string;
  title: string;
  artist: string;
  explanationText: string;
  sections?: Record<string, string>;
  tags?: string[];
  /** Optional 24kHz 16-bit LE mono PCM audio (base64) for the docent explanation. */
  audioPcmBase64?: string;
};

const DOCENT_SYSTEM = `You are a friendly human museum docent speaking directly to a visitor.

Your style:
- Talk to the visitor as "you", like you are both physically standing in front of the artwork.
- Focus immediately on the painting itself: what they are looking at, how it is painted, what details to notice.
- Sound natural, warm, and conversational — like a great audio guide, not a scripted announcement.

Grounding rules (EXTREMELY IMPORTANT):
- The title, artist, period, year, and museum provided to you are the curator-approved metadata for THIS artwork.
- You MUST treat that metadata as the single source of truth for which artwork this is.
- You MUST NOT re-identify the artwork as some other painting or by another artist, even if the style description in the prompt seems surprising.
- NEVER write things like "I've identified the artwork as...", "I think this might be...", or mention a different title or artist than the ones given.

Style constraints:
- Do NOT start with generic greetings like "Hello there! Welcome." or generic hype like "one of the most famous paintings in the world" unless it is truly essential.
- Do NOT explain what you are going to do ("I'm going to break this into sections", "I will now describe…").
- Do NOT talk about your own thinking or process.
- Do NOT mention prompts, models, AI, or the system you run on.

Your job is to give a vivid, specific description of THIS artwork — the one identified by the provided title and artist: what is in the scene, how it is composed, how it feels, and why it matters, as if you are sharing it with one curious visitor.`;

async function synthesizeDocentAudio(
  apiKey: string,
  text: string
): Promise<string | undefined> {
  if (!text.trim()) return undefined;

  try {
    const model = process.env.GEMINI_ART_AUDIO_MODEL || DEFAULT_MODEL;
    const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
      contents: [
        {
          parts: [{ text }],
        },
      ],
      // Ask Gemini to return raw PCM audio we can stream to the web client.
      responseMimeType: "audio/pcm",
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // If audio synthesis fails, fall back silently to text-only.
      const errText = await res.text();
      console.error(`Docent audio synth failed: ${res.status} ${errText}`);
      return undefined;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType?: string; data?: string };
          }>;
        };
      }>;
    };

    const audioPart =
      data.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData && p.inlineData.mimeType?.startsWith("audio/")
      )?.inlineData ?? null;

    if (!audioPart?.data) return undefined;
    return audioPart.data;
  } catch (e) {
    console.error("Docent audio synth unexpected error:", e);
    return undefined;
  }
}

export async function runDocentAgent(
  apiKey: string,
  payload: DocentPayload,
  artworkId: string
): Promise<DocentResult> {
  const model = process.env.GEMINI_ART_MODEL || DEFAULT_MODEL;
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const { title, artist = "Unknown artist", period, year, museumName } = payload;

  const prompt = `Artwork to present:
Title: ${title}
Artist: ${artist}${period ? `\nPeriod: ${period}` : ""}${year ? `\nYear: ${year}` : ""}${museumName ? `\nMuseum/Location: ${museumName}` : ""}

Write a rich but concise, visitor-friendly description (roughly 200–300 words) that a museum docent would give.

Start right away with the painting itself — what the visitor is seeing in front of them: composition, subject, mood, and how the scene is arranged. Then naturally weave in:
- how it is painted (medium, brushwork or mark-making, use of color and light, stylistic choices)
- the story and context (what we know about the subject or sitter, key historical background, how this fits into the artist's career or art movement, and why this painting matters today).

If the title, artist, period, or year are unknown or very generic (for example "Unknown" or "Not identifiable from the image"), DO NOT invent biographical or historical facts. In that case, focus almost entirely on:
- what is drawn or painted and how the subject is framed
- the visual technique (medium, texture, color choices, light and shadow)
- the feelings or atmosphere the work creates
You may say briefly that the exact history of the work is unclear, but avoid specific dates, places, or stories that are not supplied.

Throughout, point out 3–5 specific details the visitor should look for (for example: "notice the faint crackle of the varnish on the surface" or "look at how the hands are painted with soft, layered glazes"). Keep the tone welcoming and spoken, as if you were talking to one curious visitor.

FORMAT RULES (MUST FOLLOW):
- Return a single continuous description in natural prose (one or more paragraphs).
- Do NOT include section titles, headings, bullet lists, or markdown formatting of any kind.
- Do NOT describe your own thinking, analysis steps, or refinement process.
- Do NOT say "I've identified the artwork as...", "I'm now focusing on...", "I am refining the description", or anything similar.

At the very end, after a blank line, write a line that begins with "Tags:" followed by 3–6 short tags (e.g. Landscape, Oil painting, Romanticism).`;

  const body = {
    contents: [
      {
        parts: [{ text: `${DOCENT_SYSTEM}\n\n${prompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Docent Agent failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? "";
  if (!text) throw new Error("Docent Agent returned no text");

  let explanationText = text;
  const tags: string[] = [];
  const tagLine = text.match(/\nTags:\s*(.+?)(?=\n|$)/i);
  if (tagLine?.[1]) {
    explanationText = text.replace(/\nTags:\s*.+/i, "").trim();
    tags.push(
      ...tagLine[1]
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean)
    );
  }

  const audioPcmBase64 = await synthesizeDocentAudio(apiKey, explanationText);

  return {
    artworkId,
    title,
    artist,
    explanationText,
    sections: { description: explanationText },
    tags: tags.length > 0 ? tags : undefined,
    audioPcmBase64,
  };
}
