/**
 * Art Info Agent: Gemini vision + Google Search grounding to identify artwork.
 * Returns a candidate (title, artist, museum?, year?, period, confidence) for confirmation.
 */
export type ArtInfoCandidate = {
    title: string;
    artist: string;
    museum?: string;
    year?: string;
    period?: string;
    confidence: "high" | "medium" | "low";
};
export declare function runArtInfoAgent(apiKey: string, imageBase64: string, mimeType?: string): Promise<{
    candidate: ArtInfoCandidate;
    rawText?: string;
}>;
//# sourceMappingURL=art-info-agent.d.ts.map