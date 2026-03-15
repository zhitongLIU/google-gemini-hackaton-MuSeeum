import WebSocket from "ws";
const GEMINI_WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const DOCENT_SYSTEM_INSTRUCTION = `You are a friendly museum docent — knowledgeable but approachable, not stuffy. Your tone is accessible and curious; suitable for all ages. When the user shows you an image (e.g. of artwork or a scene), describe what you see in a visitor-friendly way: short summaries, context, and interesting details. When they ask a question by voice, answer concisely. If they ask you to "describe this" or show you something, describe the image clearly and engagingly.`;
export function createGeminiLiveUrl(apiKey) {
    return `${GEMINI_WS_URL}?key=${encodeURIComponent(apiKey)}`;
}
export function buildSetupMessage() {
    return {
        setup: {
            model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
            systemInstruction: {
                parts: [{ text: DOCENT_SYSTEM_INSTRUCTION }],
            },
            generationConfig: {
                responseModalities: ["TEXT", "AUDIO"],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
    };
}
export function buildRealtimeAudioMessage(base64Audio) {
    return {
        realtimeInput: {
            audio: {
                mimeType: "audio/pcm",
                data: base64Audio,
            },
        },
    };
}
export function buildRealtimeTextMessage(text) {
    return {
        realtimeInput: {
            text,
        },
    };
}
export function buildClientContentWithImage(base64Image) {
    return {
        clientContent: {
            turns: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
                            },
                        },
                        { text: "Describe what you see in this image." },
                    ],
                },
            ],
            turnComplete: true,
        },
    };
}
export function connectToGemini(apiKey, onMessage, onClose) {
    const url = createGeminiLiveUrl(apiKey);
    const geminiWs = new WebSocket(url);
    geminiWs.on("open", () => {
        geminiWs.send(JSON.stringify(buildSetupMessage()));
    });
    geminiWs.on("message", (data) => {
        const raw = data.toString();
        try {
            const msg = JSON.parse(raw);
            onMessage(msg);
        }
        catch {
            // ignore non-JSON (e.g. binary)
        }
    });
    geminiWs.on("close", onClose);
    geminiWs.on("error", () => geminiWs.close());
    return geminiWs;
}
export function sendToGemini(geminiWs, payload) {
    if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(JSON.stringify(payload));
    }
}
export function extractServerContent(msg) {
    const result = {};
    if ("setupComplete" in msg) {
        return result;
    }
    if ("outputTranscription" in msg && msg.outputTranscription && typeof msg.outputTranscription.text === "string") {
        result.outputTranscript = msg.outputTranscription.text;
        return result;
    }
    if ("inputTranscription" in msg && msg.inputTranscription && typeof msg.inputTranscription.text === "string") {
        result.inputTranscript = msg.inputTranscription.text;
        return result;
    }
    if ("serverContent" in msg && msg.serverContent) {
        const content = msg.serverContent;
        const modelTurn = content.modelTurn;
        if (modelTurn?.parts) {
            for (const part of modelTurn.parts) {
                if (part.text)
                    result.text = (result.text || "") + part.text;
                if (part.inlineData?.data)
                    result.audioBase64 = part.inlineData.data;
            }
        }
    }
    return result;
}
//# sourceMappingURL=gemini-live.js.map