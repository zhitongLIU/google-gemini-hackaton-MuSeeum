import WebSocket from "ws";
export declare function createGeminiLiveUrl(apiKey: string): string;
export declare function buildSetupMessage(): object;
export declare function buildRealtimeAudioMessage(base64Audio: string): object;
export declare function buildRealtimeTextMessage(text: string): object;
export declare function buildClientContentWithImage(base64Image: string): object;
export declare function connectToGemini(apiKey: string, onMessage: (msg: object) => void, onClose: () => void): WebSocket;
export declare function sendToGemini(geminiWs: WebSocket, payload: object): void;
export declare function extractServerContent(msg: object): {
    text?: string;
    audioBase64?: string;
    inputTranscript?: string;
    outputTranscript?: string;
};
//# sourceMappingURL=gemini-live.d.ts.map