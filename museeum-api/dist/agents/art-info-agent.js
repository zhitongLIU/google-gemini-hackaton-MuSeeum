/**
 * Art Info Agent: Gemini vision + Google Search grounding to identify artwork.
 * Returns a candidate (title, artist, museum?, year?, period, confidence) for confirmation.
 */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";
function normalizeBase64(data) {
    return data.replace(/^data:image\/\w+;base64,/, "");
}
function parseCandidateFromText(text) {
    const t = text.trim().toLowerCase();
    const titleMatch = text.match(/(?:title|artwork)\s*[:\-]\s*["']?([^"'\n]+)["']?/i) ?? text.match(/(?:^|\n)\s*["']?([^"'\n]{3,80})["']?\s*(?:by|,)/i);
    const artistMatch = text.match(/(?:artist|by)\s*[:\-]\s*["']?([^"'\n]+)["']?/i) ?? text.match(/\bby\s+([^,\n]+)/i);
    const museumMatch = text.match(/(?:museum|location|where)\s*[:\-]\s*["']?([^"'\n]+)["']?/i);
    const yearMatch = text.match(/(?:year|date|created)\s*[:\-]\s*(\d{3,4})/i) ?? text.match(/\b(1[0-5]\d{2}|16\d{2}|17\d{2}|18\d{2}|19\d{2}|20[0-2]\d)\b/);
    const periodMatch = text.match(/(?:period|movement|style)\s*[:\-]\s*["']?([^"'\n]+)["']?/i);
    const title = (titleMatch?.[1] ?? "Unknown artwork").trim();
    const artist = (artistMatch?.[1] ?? "Unknown artist").trim();
    const museum = museumMatch?.[1]?.trim();
    const year = yearMatch?.[1]?.trim();
    const period = periodMatch?.[1]?.trim();
    let confidence = "medium";
    if (t.includes("high confidence") || t.includes("confident"))
        confidence = "high";
    else if (t.includes("low confidence") || t.includes("uncertain"))
        confidence = "low";
    return { title, artist, museum, year, period, confidence };
}
export async function runArtInfoAgent(apiKey, imageBase64, mimeType = "image/jpeg") {
    const model = process.env.GEMINI_ART_MODEL || DEFAULT_MODEL;
    const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const base64 = normalizeBase64(imageBase64);
    const prompt = `You are an art expert. Identify this artwork from the image. Use web search to ground your answer in reliable sources (museum sites, art databases). Reply in the following structured form so it can be parsed:

Title: [full title of the artwork]
Artist: [artist name]
Museum: [museum or collection where it is held, if identifiable]
Year: [year or date of creation if known]
Period: [art movement or period, e.g. Romanticism, Impressionism]
Confidence: [high / medium / low]

If you cannot identify the work, give your best guess and set Confidence to low. Be concise.`;
    const body = {
        contents: [
            {
                parts: [
                    { inlineData: { mimeType, data: base64 } },
                    { text: prompt },
                ],
            },
        ],
        tools: [{ googleSearch: {} }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
        },
    };
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Art Info Agent failed: ${res.status} ${errText}`);
    }
    const data = (await res.json());
    const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? "";
    if (!text)
        throw new Error("Art Info Agent returned no text");
    const candidate = parseCandidateFromText(text);
    return { candidate, rawText: text };
}
//# sourceMappingURL=art-info-agent.js.map