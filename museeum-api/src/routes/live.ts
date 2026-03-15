import type { WebSocket } from "ws";
import {
  connectToGemini,
  sendToGemini,
  extractServerContent,
  buildRealtimeAudioMessage,
  buildRealtimeTextMessage,
  buildRealtimeVideoMessage,
} from "../live/gemini-live.js";
import { getSession } from "./session.js";
import { validateAppIdFromQuery } from "../middleware/app-id.js";

function validateJudgeAccessCode(accessCode: string | undefined): boolean {
  const expected = process.env.JUDGE_ACCESS_CODE;
  if (!expected) return true;
  return accessCode === expected;
}

type ClientMessage =
  | { type: "audio"; data: string }
  | { type: "image"; data: string }
  | { type: "text"; data: string };

export function attachLiveWs(app: import("express").Express): void {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set; Live WebSocket will reject connections.");
  }

  // express-ws augments app with .ws()
  const appWithWs = app as import("express").Express & {
    ws: (path: string, handler: (ws: WebSocket, req: import("express").Request) => void) => void;
  };

  appWithWs.ws("/api/live/:sessionId", (clientWs, req) => {
    const appId = req.query?.appId as string | undefined;
    if (!validateAppIdFromQuery(appId)) {
      clientWs.close(4401, "Invalid or missing app id");
      return;
    }
    const accessCode = req.query?.accessCode as string | undefined;
    if (!validateJudgeAccessCode(accessCode)) {
      clientWs.close(4402, "Invalid or missing access code");
      return;
    }

    const sessionId = req.params.sessionId as string;
    if (getSession(sessionId) === undefined && apiKey) {
      // Optional: validate session exists (MVP allows any sessionId)
    }

    let geminiWs: WebSocket | null = null;
    let setupComplete = false;
    let errorForwarded = false;

    function forwardToClient(payload: { type: string; data?: string }) {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    }

    function connectGemini() {
      if (!apiKey) {
        forwardToClient({ type: "error", data: "GEMINI_API_KEY not set" });
        return;
      }
      errorForwarded = false;
      const onClose = () => {
        const wasReady = setupComplete;
        setupComplete = false;
        geminiWs = null;
        if (wasReady) {
          forwardToClient({ type: "reconnecting", data: "Reconnecting…" });
          setTimeout(() => connectGemini(), 800);
        } else if (!errorForwarded) {
          forwardToClient({
            type: "error",
            data: "Live Agent connection closed before ready. Check GEMINI_API_KEY and that the Live API is enabled.",
          });
        }
      };
      geminiWs = connectToGemini(
        apiKey,
        (msg) => {
          if ("setupComplete" in msg) {
            setupComplete = true;
            forwardToClient({ type: "ready" });
            return;
          }
          const { text, audioBase64, inputTranscript, outputTranscript } = extractServerContent(msg);
          if (outputTranscript) forwardToClient({ type: "text", data: outputTranscript });
          if (text) forwardToClient({ type: "text", data: text });
          if (audioBase64) forwardToClient({ type: "audio", data: audioBase64 });
          if (inputTranscript) forwardToClient({ type: "inputTranscript", data: inputTranscript });
        },
        onClose,
        (errMessage) => {
          errorForwarded = true;
          forwardToClient({ type: "error", data: errMessage });
          setupComplete = false;
          geminiWs = null;
        }
      );
    }

    connectGemini();

    clientWs.on("message", (data: Buffer | ArrayBuffer | Buffer[] | string) => {
      if (!geminiWs || !setupComplete) return;

      const buf = Buffer.isBuffer(data) ? data : typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.concat(data as Buffer[]);
      const raw = buf.toString("utf8");

      // Try JSON (client sends { type: 'audio'|'image'|'text', data })
      let parsed: ClientMessage | null = null;
      if (raw.startsWith("{")) {
        try {
          parsed = JSON.parse(raw) as ClientMessage;
        } catch {
          /* not JSON */
        }
      }
      if (parsed?.type === "audio" && parsed.data) {
        sendToGemini(geminiWs!, buildRealtimeAudioMessage(parsed.data));
      } else if (parsed?.type === "image" && parsed.data) {
        sendToGemini(geminiWs!, buildRealtimeVideoMessage(parsed.data));
        sendToGemini(geminiWs!, buildRealtimeTextMessage("This is the artwork the visitor is looking at. Start presenting it now: describe what you see, give brief context, and invite questions. Then listen for their voice."));
      } else if (parsed?.type === "text" && parsed.data) {
        sendToGemini(geminiWs!, buildRealtimeTextMessage(parsed.data));
      } else if (buf.length > 0) {
        // Binary or non-JSON: treat as raw PCM → base64 for Gemini
        sendToGemini(geminiWs!, buildRealtimeAudioMessage(buf.toString("base64")));
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
