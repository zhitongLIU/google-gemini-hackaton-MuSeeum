import { useState, useEffect, useRef, useCallback } from "react";

const getWsUrl = (sessionId: string, accessCode?: string | null) => {
  const base = import.meta.env.VITE_API_URL || "http://localhost:8080";
  const appId = import.meta.env.VITE_MUSEEUM_APP_ID;
  const wsProtocol = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  const path = `/api/live/${sessionId}`;
  const params = new URLSearchParams();
  if (appId) params.set("appId", appId);
  if (accessCode) params.set("accessCode", accessCode);
  const query = params.toString() ? `?${params.toString()}` : "";
  return `${wsProtocol}://${host}${path}${query}`;
};

const PCM_SAMPLE_RATE = 24000; // Gemini Live output is 24kHz 16-bit LE mono
const INPUT_PCM_RATE = 16000; // Gemini Live input expects 16kHz 16-bit LE mono

/** Float32 mono -> 16kHz 16-bit LE PCM base64 (for Live API streaming) */
function float32ToPcmBase64(float32: Float32Array, srcSampleRate: number): string {
  const ratio = srcSampleRate / INPUT_PCM_RATE;
  const dstLength = Math.floor(float32.length / ratio);
  const pcm = new Int16Array(dstLength);
  for (let i = 0; i < dstLength; i++) {
    const s = float32[Math.floor(i * ratio)] ?? 0;
    const clamped = Math.max(-1, Math.min(1, s));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function playPcmBase64(
  base64: string,
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  nextStartTimeRef: React.MutableRefObject<number>,
  playingSourcesRef: React.MutableRefObject<Set<AudioBufferSourceNode>>
) {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const numSamples = bytes.length / 2;
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }
    if (numSamples === 0) return;

    let ctx = audioContextRef.current;
    if (!ctx) {
      ctx = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
      audioContextRef.current = ctx;
    }
    if (ctx.state === "suspended") ctx.resume();

    const buffer = ctx.createBuffer(1, numSamples, PCM_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => playingSourcesRef.current.delete(source);
    playingSourcesRef.current.add(source);
    const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  } catch (e) {
    console.warn("Audio playback failed:", e);
  }
}

function stopAgentPlayback(
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  nextStartTimeRef: React.MutableRefObject<number>,
  playingSourcesRef: React.MutableRefObject<Set<AudioBufferSourceNode>>
) {
  const ctx = audioContextRef.current;
  if (ctx) nextStartTimeRef.current = ctx.currentTime;
  playingSourcesRef.current.forEach((source) => {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
  });
  playingSourcesRef.current.clear();
}

type Status = "disconnected" | "connecting" | "ready" | "error";

export function useLiveSession(sessionId: string | null, accessCode?: string | null) {
  const [status, setStatus] = useState<Status>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [inputTranscript, setInputTranscript] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const readyRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNextStartTimeRef = useRef(0);
  const playingSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const lastInterruptAtRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setStatus("disconnected");
      setErrorMessage(null);
      return;
    }
    setStatus("connecting");
    setErrorMessage(null);
    readyRef.current = false;
    const url = getWsUrl(sessionId, accessCode);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    const timeout = window.setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) return;
      setStatus("error");
      setErrorMessage("Live Agent is taking too long. Check that the backend is running and GEMINI_API_KEY is set (see museeum-api/.env). If the API runs on another port, set VITE_API_URL (e.g. VITE_API_URL=http://localhost:3080 npm run dev).");
    }, 15000);

    ws.onopen = () => {
      setTranscript("");
      setInputTranscript("");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; data?: string };
        if (msg.type === "ready") {
          window.clearTimeout(timeout);
          readyRef.current = true;
          setStatus("ready");
        } else if (msg.type === "reconnecting") {
          readyRef.current = false;
          setStatus("connecting");
          setErrorMessage(null);
        } else if (msg.type === "error") {
          window.clearTimeout(timeout);
          setStatus("error");
          setErrorMessage(msg.data || "Live Agent error");
        } else if (msg.type === "text" && msg.data) {
          audioNextStartTimeRef.current = 0;
          setTranscript((t) => t + msg.data!);
        } else if (msg.type === "inputTranscript" && msg.data) setInputTranscript((t) => t + (t ? " " : "") + msg.data!);
        else if (msg.type === "audio" && msg.data) {
          playPcmBase64(msg.data, audioContextRef, audioNextStartTimeRef, playingSourcesRef);
        }
      } catch {
        /* ignore non-JSON */
      }
    };

    ws.onclose = () => {
      window.clearTimeout(timeout);
      wsRef.current = null;
      if (!readyRef.current) {
        setStatus("error");
        setErrorMessage("Connection closed. Is the backend running? Use VITE_API_URL if it runs on a different port (e.g. 3080).");
      } else {
        setStatus("disconnected");
      }
    };
    ws.onerror = () => {
      window.clearTimeout(timeout);
      setStatus("error");
      setErrorMessage("WebSocket error. Check backend URL (VITE_API_URL) and that the server is running.");
    };

    return () => {
      window.clearTimeout(timeout);
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, accessCode]);

  const sendJson = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const sendImage = useCallback(
    (dataUrl: string) => {
      stopAgentPlayback(audioContextRef, audioNextStartTimeRef, playingSourcesRef);
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
      sendJson({ type: "image", data: base64 });
    },
    [sendJson]
  );

  // Always-on mic: stream raw PCM to the Live Agent over the same WebSocket (continuous connection)
  useEffect(() => {
    if (status !== "ready") {
      processorRef.current?.disconnect();
      processorRef.current = null;
      captureContextRef.current?.close();
      captureContextRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const ctx = new AudioContext();
        captureContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const bufferSize = 2048;
        const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (cancelled || wsRef.current?.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          let rms = 0;
          for (let i = 0; i < input.length; i++) rms += input[i]! * input[i]!;
          rms = Math.sqrt(rms / input.length);
          const now = Date.now();
          if (rms > 0.02 && now - lastInterruptAtRef.current > 600) {
            lastInterruptAtRef.current = now;
            stopAgentPlayback(audioContextRef, audioNextStartTimeRef, playingSourcesRef);
          }
          const base64 = float32ToPcmBase64(input, e.inputBuffer.sampleRate);
          if (base64) sendJson({ type: "audio", data: base64 });
        };

        source.connect(processor);
        const gain = ctx.createGain();
        gain.gain.value = 0;
        processor.connect(gain);
        gain.connect(ctx.destination);
      } catch (e) {
        if (!cancelled) console.error("Failed to start microphone", e);
      }
    })();

    return () => {
      cancelled = true;
      processorRef.current?.disconnect();
      processorRef.current = null;
      captureContextRef.current?.close();
      captureContextRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [status, sendJson]);

  return {
    status,
    errorMessage,
    transcript,
    inputTranscript,
    sendImage,
  };
}
