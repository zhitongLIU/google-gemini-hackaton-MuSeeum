import WebSocket from "ws";

const GEMINI_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

const DOCENT_SYSTEM_INSTRUCTION = `You are a friendly museum docent — knowledgeable but approachable, not stuffy. Your tone is accessible and curious; suitable for all ages. When the user shows you an image (e.g. of artwork or a scene), describe what you see in a visitor-friendly way: short summaries, context, and interesting details. When they ask a question by voice, answer concisely. If they ask you to "describe this" or show you something, describe the image clearly and engagingly.`;

export function createGeminiLiveUrl(apiKey: string): string {
  return `${GEMINI_WS_URL}?key=${encodeURIComponent(apiKey)}`;
}

const DEFAULT_LIVE_MODEL = "models/gemini-2.5-flash-native-audio-preview-12-2025";

export function buildSetupMessage(): object {
  const model = process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;
  const modelId = model.startsWith("models/") ? model : `models/${model}`;
  // Native audio model often accepts only AUDIO in responseModalities
  const isNativeAudio = modelId.includes("native-audio");
  const responseModalities = isNativeAudio ? ["AUDIO"] : ["AUDIO", "TEXT"];
  return {
    setup: {
      model: modelId,
      systemInstruction: {
        parts: [{ text: DOCENT_SYSTEM_INSTRUCTION }],
      },
      generationConfig: {
        responseModalities,
      },
    },
  };
}

export function buildRealtimeAudioMessage(base64Audio: string): object {
  return {
    realtimeInput: {
      audio: {
        mimeType: "audio/pcm",
        data: base64Audio,
      },
    },
  };
}

export function buildRealtimeTextMessage(text: string): object {
  return {
    realtimeInput: {
      text,
    },
  };
}

/** Normalize base64 image (strip data URL prefix if present) */
function normalizeImageData(data: string): string {
  return data.replace(/^data:image\/\w+;base64,/, "");
}

/** Send a single image/frame as realtimeInput.video so the Live Agent sees it in the same session (≤1 FPS). */
export function buildRealtimeVideoMessage(base64Image: string, mimeType = "image/jpeg"): object {
  return {
    realtimeInput: {
      video: {
        mimeType,
        data: normalizeImageData(base64Image),
      },
    },
  };
}

/** Legacy: clientContent turn (can close the session on some models). Prefer buildRealtimeVideoMessage for live sessions. */
export function buildClientContentWithImage(base64Image: string): object {
  return {
    clientContent: {
      turns: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: normalizeImageData(base64Image),
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

export function connectToGemini(
  apiKey: string,
  onMessage: (msg: object) => void,
  onClose: () => void,
  onError?: (message: string) => void
): WebSocket {
  const url = createGeminiLiveUrl(apiKey);
  const geminiWs = new WebSocket(url);

  geminiWs.on("open", () => {
    const setup = buildSetupMessage();
    console.log("[Gemini Live] Connected, sending setup (model: %s)", (setup as { setup: { model: string } }).setup.model);
    geminiWs.send(JSON.stringify(setup));
  });

  geminiWs.on("message", (data: WebSocket.RawData) => {
    const raw = data.toString();
    try {
      const msg = JSON.parse(raw) as Record<string, unknown>;
      if (msg.error) {
        const err = msg.error as { message?: string; code?: number; status?: string };
        const message = err.message || err.status || JSON.stringify(msg.error);
        console.error("[Gemini Live] Error from API:", message);
        onError?.(String(message));
        return;
      }
      if ("setupComplete" in msg) {
        console.log("[Gemini Live] setupComplete received");
      }
      onMessage(msg);
    } catch {
      // ignore non-JSON (e.g. binary)
    }
  });

  geminiWs.on("close", (code, reason: Buffer | undefined) => {
    const reasonStr =
      reason && reason.length > 0
        ? (Buffer.isBuffer(reason) ? reason.toString("utf8") : String(reason))
        : `code ${code}`;
    console.log("[Gemini Live] Closed:", code, reasonStr);
    onClose();
    if (code !== 1000 && reasonStr && reasonStr !== `code ${code}`) {
      onError?.(reasonStr);
    }
  });
  geminiWs.on("error", (err) => {
    console.error("[Gemini Live] WebSocket error:", err.message);
    onError?.(err.message || "Gemini connection error");
    geminiWs.close();
  });

  return geminiWs;
}

export function sendToGemini(geminiWs: WebSocket, payload: object): void {
  if (geminiWs.readyState === WebSocket.OPEN) {
    geminiWs.send(JSON.stringify(payload));
  }
}

export function extractServerContent(msg: object): {
  text?: string;
  audioBase64?: string;
  inputTranscript?: string;
  outputTranscript?: string;
} {
  const result: {
    text?: string;
    audioBase64?: string;
    inputTranscript?: string;
    outputTranscript?: string;
  } = {};

  if ("setupComplete" in msg) {
    return result;
  }

  if ("outputTranscription" in msg && msg.outputTranscription && typeof (msg.outputTranscription as { text?: string }).text === "string") {
    result.outputTranscript = (msg.outputTranscription as { text: string }).text;
    return result;
  }

  if ("inputTranscription" in msg && msg.inputTranscription && typeof (msg.inputTranscription as { text?: string }).text === "string") {
    result.inputTranscript = (msg.inputTranscription as { text: string }).text;
    return result;
  }

  if ("serverContent" in msg && msg.serverContent) {
    const content = msg.serverContent as {
      modelTurn?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> };
    };
    const modelTurn = content.modelTurn;
    if (modelTurn?.parts) {
      for (const part of modelTurn.parts) {
        if (part.text) result.text = (result.text || "") + part.text;
        if (part.inlineData?.data) result.audioBase64 = part.inlineData.data;
      }
    }
  }

  return result;
}
