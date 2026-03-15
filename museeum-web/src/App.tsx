import { useState, useEffect, useRef } from "react";
import { CameraView } from "./components/CameraView";
import { createSession } from "./lib/api";
import { useLiveSession } from "./hooks/useLiveSession";
import "./App.css";

const ACCESS_CODE_KEY = "museeum_access_code";

function AccessCodeGate({
  onSubmit,
  error,
}: {
  onSubmit: (code: string) => void;
  error: string | null;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="w-full max-w-sm flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Access code"
        className="w-full px-4 py-3 rounded-lg bg-black/40 border border-neutral-600 text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
        autoComplete="off"
      />
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      <button
        type="submit"
        className="py-3 px-6 rounded-full font-medium bg-violet-600 text-white disabled:opacity-50 touch-manipulation"
        disabled={!value.trim()}
      >
        Continue
      </button>
    </form>
  );
}

function getInitialAccessCode(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("access") ?? params.get("accessCode");
  if (fromUrl?.trim()) {
    try {
      sessionStorage.setItem(ACCESS_CODE_KEY, fromUrl.trim());
    } catch {
      /* ignore */
    }
    return fromUrl.trim();
  }
  try {
    const stored = sessionStorage.getItem(ACCESS_CODE_KEY);
    return stored || null;
  } catch {
    return null;
  }
}

function App() {
  const [accessCode, setAccessCode] = useState<string | null>(getInitialAccessCode);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const sentInitialImageRef = useRef(false);
  const { status, errorMessage, transcript, inputTranscript, sendImage } = useLiveSession(sessionId, accessCode);

  // Create session only after user captures an artwork (capture-first flow)
  useEffect(() => {
    if (!capturedImage) return;
    let cancelled = false;
    setSessionError(null);
    setGateError(null);
    createSession(accessCode ?? undefined)
      .then(({ sessionId: id }) => {
        if (!cancelled) setSessionId(id);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to create session";
        if (msg === "Invalid or missing access code" || msg === "Access denied") {
          try {
            sessionStorage.removeItem(ACCESS_CODE_KEY);
          } catch {
            /* ignore */
          }
          setAccessCode(null);
          setCapturedImage(null);
          setGateError("Invalid access code. Please use the link or code from the organizers.");
          setShowGate(true);
        } else {
          setSessionError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [capturedImage]);

  // When Live Agent is ready, send the captured artwork first so it can present it and then interact
  useEffect(() => {
    if (status !== "ready" || !capturedImage || sentInitialImageRef.current) return;
    sentInitialImageRef.current = true;
    sendImage(capturedImage);
  }, [status, capturedImage, sendImage]);

  const handleSubmitAccessCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      sessionStorage.setItem(ACCESS_CODE_KEY, trimmed);
    } catch {
      /* ignore */
    }
    setGateError(null);
    setShowGate(false);
    setAccessCode(trimmed);
  };

  const handleFrameCapture = (dataUrl: string) => {
    if (!sessionId) {
      setCapturedImage(dataUrl);
    } else {
      sendImage(dataUrl);
    }
  };

  if (showGate) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-xl font-semibold mb-2">MuSeeum</h1>
        <p className="text-neutral-400 text-sm mb-6 text-center max-w-sm">
          Enter the access code provided by the organizers, or open the judge link they gave you.
        </p>
        <AccessCodeGate onSubmit={handleSubmitAccessCode} error={gateError} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-4">
      <h1 className="text-xl font-semibold mb-1">MuSeeum</h1>
      <p className="text-neutral-400 text-sm mb-4">
        {!capturedImage && "Capture an artwork to start the live tour"}
        {capturedImage && !sessionId && "Starting presentation…"}
        {sessionId && "Docent is presenting — ask questions or describe another image"}
      </p>

      {sessionError && (
        <p className="text-red-400 text-sm mb-2">{sessionError}</p>
      )}

      <div className="w-full max-w-lg flex flex-col gap-4">
        <CameraView
          onFrameCapture={handleFrameCapture}
          buttonLabel={sessionId ? "Describe this" : "Capture artwork"}
          videoEnabled
          audioEnabled
        />

        {(sessionId || capturedImage) && (
          <div className="flex flex-col gap-2">
            <p className="text-neutral-500 text-xs">
              {capturedImage && !sessionId && "Status: Starting presentation…"}
              {sessionId && status === "connecting" && "Status: Connecting…"}
              {sessionId && status === "ready" && !transcript && "Status: Presenting artwork…"}
              {sessionId && status === "ready" && transcript && "Status: Listening — speak or tap Describe this"}
              {sessionId && status === "disconnected" && "Status: Disconnected"}
              {sessionId && status === "error" && "Status: Error"}
            </p>
            {status === "error" && errorMessage && (
              <p className="text-red-400 text-xs max-w-md text-left">{errorMessage}</p>
            )}

            {(inputTranscript || transcript) && (
              <div className="mt-2 p-3 rounded-lg bg-black/40 text-left text-sm space-y-1">
                {inputTranscript && (
                  <p className="text-neutral-400">You: {inputTranscript}</p>
                )}
                {transcript && (
                  <p className="text-white">Docent: {transcript}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
