/**
 * Docent Agent: Gemini text generation for visitor-friendly artwork description.
 * Uses confirmed art metadata (no grounding); returns explanationText, sections, tags.
 */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";
const DOCENT_SYSTEM = `You are a friendly museum docent — knowledgeable but approachable, not stuffy. Your tone is accessible and curious; suitable for all ages. Give short summaries, context, and interesting stories. Do not fabricate facts; stick to what is known about the artwork.`;
export async function runDocentAgent(apiKey, payload, artworkId) {
    const model = process.env.GEMINI_ART_MODEL || DEFAULT_MODEL;
    const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const { title, artist = "Unknown artist", period, year, museumName } = payload;
    const prompt = `Artwork to present:
Title: ${title}
Artist: ${artist}${period ? `\nPeriod: ${period}` : ""}${year ? `\nYear: ${year}` : ""}${museumName ? `\nMuseum/Location: ${museumName}` : ""}

Write a visitor-friendly description (2–4 short paragraphs) that a museum docent would give. Include: what we see in the work, the artist's context, the period or movement, and why it matters. Then list 3–6 short tags (e.g. Landscape, Oil painting, Romanticism) on a line starting with "Tags:".`;
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
    const data = (await res.json());
    const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? "";
    if (!text)
        throw new Error("Docent Agent returned no text");
    let explanationText = text;
    const tags = [];
    const tagLine = text.match(/\nTags:\s*(.+?)(?=\n|$)/i);
    if (tagLine?.[1]) {
        explanationText = text.replace(/\nTags:\s*.+/i, "").trim();
        tags.push(...tagLine[1]
            .split(/[,;]/)
            .map((t) => t.trim())
            .filter(Boolean));
    }
    return {
        artworkId,
        title,
        artist,
        explanationText,
        sections: { description: explanationText },
        tags: tags.length > 0 ? tags : undefined,
    };
}
//# sourceMappingURL=docent-agent.js.map