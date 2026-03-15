import { connectToGemini, sendToGemini, extractServerContent, buildRealtimeAudioMessage, buildRealtimeTextMessage, buildClientContentWithImage, } from "../live/gemini-live.js";
import { getSession } from "./session.js";
export function attachLiveWs(app) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("GEMINI_API_KEY not set; Live WebSocket will reject connections.");
    }
    // express-ws augments app with .ws()
    const appWithWs = app;
    appWithWs.ws("/api/live/:sessionId", (clientWs, req) => {
        const sessionId = req.params.sessionId;
        if (getSession(sessionId) === undefined && apiKey) {
            // Optional: validate session exists (MVP allows any sessionId)
        }
        let geminiWs = null;
        let setupComplete = false;
        function forwardToClient(payload) {
            if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(JSON.stringify(payload));
            }
        }
        function connectGemini() {
            if (!apiKey) {
                forwardToClient({ type: "error", data: "GEMINI_API_KEY not set" });
                return;
            }
            geminiWs = connectToGemini(apiKey, (msg) => {
                if ("setupComplete" in msg) {
                    setupComplete = true;
                    forwardToClient({ type: "ready" });
                    return;
                }
                const { text, audioBase64, inputTranscript, outputTranscript } = extractServerContent(msg);
                if (outputTranscript)
                    forwardToClient({ type: "text", data: outputTranscript });
                if (text)
                    forwardToClient({ type: "text", data: text });
                if (audioBase64)
                    forwardToClient({ type: "audio", data: audioBase64 });
                if (inputTranscript)
                    forwardToClient({ type: "inputTranscript", data: inputTranscript });
            }, () => {
                setupComplete = false;
                geminiWs = null;
            });
        }
        connectGemini();
        clientWs.on("message", (data) => {
            if (!geminiWs || !setupComplete)
                return;
            const buf = Buffer.isBuffer(data) ? data : typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.concat(data);
            const raw = buf.toString("utf8");
            // Try JSON (client sends { type: 'audio'|'image'|'text', data })
            let parsed = null;
            if (raw.startsWith("{")) {
                try {
                    parsed = JSON.parse(raw);
                }
                catch {
                    /* not JSON */
                }
            }
            if (parsed?.type === "audio" && parsed.data) {
                sendToGemini(geminiWs, buildRealtimeAudioMessage(parsed.data));
            }
            else if (parsed?.type === "image" && parsed.data) {
                sendToGemini(geminiWs, buildClientContentWithImage(parsed.data));
            }
            else if (parsed?.type === "text" && parsed.data) {
                sendToGemini(geminiWs, buildRealtimeTextMessage(parsed.data));
            }
            else if (buf.length > 0) {
                // Binary or non-JSON: treat as raw PCM → base64 for Gemini
                sendToGemini(geminiWs, buildRealtimeAudioMessage(buf.toString("base64")));
            }
        });
        clientWs.on("close", () => {
            if (geminiWs) {
                geminiWs.close();
                geminiWs = null;
            }
        });
    });
}
//# sourceMappingURL=live.js.map