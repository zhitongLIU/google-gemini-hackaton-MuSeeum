/**
 * Docent Agent: Gemini text generation for visitor-friendly artwork description.
 * Uses confirmed art metadata (no grounding); returns explanationText, sections, tags.
 */
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
};
export declare function runDocentAgent(apiKey: string, payload: DocentPayload, artworkId: string): Promise<DocentResult>;
//# sourceMappingURL=docent-agent.d.ts.map