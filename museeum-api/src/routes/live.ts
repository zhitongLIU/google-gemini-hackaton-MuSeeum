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
    const artworkId = (req.query?.artworkId as string | undefined) ?? undefined;
    const artworkTitle = (req.query?.artworkTitle as string | undefined) ?? undefined;
    const artworkArtist = (req.query?.artworkArtist as string | undefined) ?? undefined;
    const artworkYear = (req.query?.artworkYear as string | undefined) ?? undefined;
    const artworkPeriod = (req.query?.artworkPeriod as string | undefined) ?? undefined;
    const artworkMuseumName =
      (req.query?.artworkMuseumName as string | undefined) ?? undefined;
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
            if (artworkId) {
              const metaLines: string[] = [];
              if (artworkTitle) metaLines.push(`Title: ${artworkTitle}`);
              if (artworkArtist) metaLines.push(`Artist: ${artworkArtist}`);
              if (artworkYear) metaLines.push(`Year: ${artworkYear}`);
              if (artworkPeriod) metaLines.push(`Art period: ${artworkPeriod}`);
              if (artworkMuseumName) metaLines.push(`Museum/location: ${artworkMuseumName}`);

              const contextText = [
                "You and the visitor are in a museum, standing in front of the same artwork that was already analyzed earlier in this visit.",
                "The system has already identified the artwork and shown the visitor information about it above this live conversation.",
                metaLines.length
                  ? "Here is the curator-approved metadata for THIS artwork (do not contradict it or re-identify the work as something else):"
                  : null,
                metaLines.length ? metaLines.join(" | ") : null,
                "Continue speaking as a human docent about THIS artwork, using what you can see in the image and what you know from this metadata.",
                "Do not ask the visitor to provide another image unless they explicitly want to change artworks.",
              ]
                .filter((line): line is string => Boolean(line))
                .join("\n");

              sendToGemini(geminiWs!, buildRealtimeTextMessage(contextText));
            }
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

        const imagePromptLines: string[] = [
          "You and the visitor are standing in front of this artwork right now.",
        ];
        if (artworkTitle || artworkArtist || artworkYear || artworkPeriod || artworkMuseumName) {
          const metaBits: string[] = [];
          if (artworkTitle) metaBits.push(`Title: ${artworkTitle}`);
          if (artworkArtist) metaBits.push(`Artist: ${artworkArtist}`);
          if (artworkYear) metaBits.push(`Year: ${artworkYear}`);
          if (artworkPeriod) metaBits.push(`Art period: ${artworkPeriod}`);
          if (artworkMuseumName) metaBits.push(`Museum/location: ${artworkMuseumName}`);
          imagePromptLines.push(
            "This is the same artwork whose metadata the visitor can see above the live conversation. Use this metadata as ground truth:",
            metaBits.join(" | ")
          );
        }
        imagePromptLines.push(
          "Describe what you both are seeing in a natural, human way: a short vivid description, a bit of story or context, and one or two interesting details.",
          "Then keep the conversation open and listen for their questions."
        );

        sendToGemini(geminiWs!, buildRealtimeTextMessage(imagePromptLines.join("\n")));
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
