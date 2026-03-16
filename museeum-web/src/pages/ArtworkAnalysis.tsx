import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { store } from "../context/AppContext";
import { useApp } from "../context/AppContext";
import { PhotoViewer } from "../components/PhotoViewer";
import { useLiveSession } from "../hooks/useLiveSession";
import { createSession } from "../lib/api";

const LIVE_KEEP_ALIVE_MS = 10000;

const CANONICAL_ART_PERIODS = [
  "Prehistoric",
  "Byzantine",
  "Romanesque",
  "Gothic",
  "Renaissance",
  "Mannerism",
  "Baroque",
  "Rococo",
  "Neoclassicism",
  "Romanticism",
  "Realism",
  "Impressionism",
  "Post-Impressionism",
  "Expressionism",
  "Cubism",
  "Surrealism",
  "Abstract Expressionism",
  "Pop Art",
  "Morden",
] as const;

function normalizeArtPeriodLabel(period: string | undefined | null): string | undefined | null {
  if (!period) return period;
  const lower = period.toLowerCase();
  for (const label of CANONICAL_ART_PERIODS) {
    if (lower.includes(label.toLowerCase())) {
      return label;
    }
  }
  return period;
}

const DOCENT_PCM_SAMPLE_RATE = 24000; // Must match backend audioPcmBase64 sample rate

function playPcmBase64(
  base64: string,
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  nextStartTimeRef: React.MutableRefObject<number>,
  playingSourcesRef: React.MutableRefObject<Set<AudioBufferSourceNode>>
) {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)!;
    const view = new DataView(bytes.buffer);
    const numSamples = bytes.length / 2;
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }
    if (numSamples === 0) return;

    let ctx = audioContextRef.current;
    if (!ctx) {
      ctx = new AudioContext({ sampleRate: DOCENT_PCM_SAMPLE_RATE });
      audioContextRef.current = ctx;
    }
    if (ctx.state === "suspended") void ctx.resume();

    const buffer = ctx.createBuffer(1, numSamples, DOCENT_PCM_SAMPLE_RATE);
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
    console.warn("Docent audio playback failed:", e);
  }
}

function stopDocentPlayback(
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

export function ArtworkAnalysis() {
  const { sessionId, artworkId } = useParams<{ sessionId: string; artworkId: string }>();
  const navigate = useNavigate();
  const { accessCode } = useApp();
  const [refresh, setRefresh] = useState(0);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [holdingMic, setHoldingMic] = useState(false);
  /** Keep live connection open briefly after release so we can receive the AI response. */
  const [keepAliveUntil, setKeepAliveUntil] = useState(0);
  const keepAliveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHoldingRef = useRef(holdingMic);
  const artwork = useMemo(
    () => (artworkId ? store.getArtwork(artworkId) : undefined),
    [artworkId, refresh]
  );
  const liveActive = holdingMic || keepAliveUntil > 0;
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const { status, transcript, inputTranscript, sendImage, errorMessage } = useLiveSession(
    liveSessionId,
    accessCode,
    { isRecording: holdingMic, artworkId }
  );

  const docentAudioContextRef = useRef<AudioContext | null>(null);
  const docentAudioNextStartTimeRef = useRef(0);
  const docentPlayingSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const initialImageSentRef = useRef(false);

  // Create a fresh live-agent session for this artwork detail view,
  // independent from the visit/sessionId used for gallery navigation.
  useEffect(() => {
    let cancelled = false;
    setLiveSessionId(null);
    if (!accessCode) return;
    createSession(accessCode)
      .then(({ sessionId: newId }) => {
        if (!cancelled) {
          setLiveSessionId(newId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // leave liveSessionId as null; error will be surfaced via other UI if needed
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessCode, artworkId]);

  // When user releases, keep connection alive briefly so we can receive the AI response
  useEffect(() => {
    const wasHolding = prevHoldingRef.current;
    prevHoldingRef.current = holdingMic;
    if (wasHolding && !holdingMic) {
      setKeepAliveUntil(1);
      keepAliveTimerRef.current = setTimeout(() => setKeepAliveUntil(0), LIVE_KEEP_ALIVE_MS);
    }
    return () => {
      if (keepAliveTimerRef.current) {
        clearTimeout(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
    };
  }, [holdingMic]);

  useEffect(() => {
    initialImageSentRef.current = false;
  }, [artworkId]);

  // When Live Agent is ready, send the current artwork image as context once
  useEffect(() => {
    if (status === "ready" && artwork?.photos?.[0] && !initialImageSentRef.current) {
      initialImageSentRef.current = true;
      sendImage(artwork.photos[0]);
    }
  }, [status, artwork?.photos?.[0], sendImage]);

  const handlePressStart = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    setHoldingMic(true);
    setKeepAliveUntil(0);
    if (keepAliveTimerRef.current) {
      clearTimeout(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
  }, []);

  const handlePressEnd = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    setHoldingMic(false);
  }, []);

  const micButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = micButtonRef.current;
    if (!el) return;
    const onTouchStart = () => {
      setHoldingMic(true);
      setKeepAliveUntil(0);
      if (keepAliveTimerRef.current) {
        clearTimeout(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      setHoldingMic(false);
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  if (!artworkId || !artwork) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-text">Artwork not found.</p>
        {sessionId && (
          <button
            type="button"
            onClick={() => navigate(`/visit/${sessionId}`)}
            className="ml-2 text-gold-primary"
          >
            Back to gallery
          </button>
        )}
      </div>
    );
  }

  const toggleLike = () => {
    store.updateArtwork(artworkId, { liked: !artwork.liked });
    setRefresh((r) => r + 1);
  };

  const handleDelete = () => {
    if (!artworkId) return;
    // Simple confirm; no undo, since data is local to this browser
    const ok = window.confirm("Remove this artwork from your visit?");
    if (!ok) return;
    store.deleteArtwork(artworkId);
    if (sessionId) navigate(`/visit/${sessionId}`);
    else navigate("/");
  };

  const photoCount = artwork.photos?.length ?? 0;

  const handleBack = () => {
    // Stop any docent audio and live agent audio when leaving the page.
    stopDocentPlayback(
      docentAudioContextRef,
      docentAudioNextStartTimeRef,
      docentPlayingSourcesRef
    );
    setHoldingMic(false);
    setKeepAliveUntil(0);
    setLiveSessionId(null);
    if (keepAliveTimerRef.current) {
      clearTimeout(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    navigate(sessionId ? `/visit/${sessionId}` : "/");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-divider shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-divider"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 font-semibold text-dark-text truncate text-center font-serif">
          {artwork.title}
        </h1>
        <button
          type="button"
          onClick={toggleLike}
          className="p-2 rounded-full hover:bg-divider"
          aria-label={artwork.liked ? "Unlike" : "Like"}
        >
          <span className={artwork.liked ? "text-heart" : "text-light-gray"}>♥</span>
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4 pb-28">
        {artwork.photos[0] && (
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-divider mb-4">
            <button
              type="button"
              onClick={() => setPhotoViewerOpen(true)}
              className="block w-full h-full"
            >
              <img
                src={artwork.photos[0]}
                alt={artwork.title}
                className="w-full h-full object-contain"
              />
            </button>
            <span className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs">
              AI Analyzed
            </span>
            {photoCount > 1 && (
              <span className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs">
                1/{photoCount}
              </span>
            )}
          </div>
        )}
        <p className="text-gold-dark font-medium text-dark-text">{artwork.artist}</p>
        <div className="flex flex-wrap gap-2 my-2">
          {artwork.year && (
            <span className="px-2 py-1 rounded-full bg-divider text-sm text-gray-text">
              {artwork.year}
            </span>
          )}
          {artwork.museumName && (
            <span className="px-2 py-1 rounded-full bg-divider text-sm text-gray-text">
              {artwork.museumName}
            </span>
          )}
        </div>
        {artwork.period && (
          <div className="flex items-center gap-2 my-2">
            <span className="text-sm text-gray-text">Art Period</span>
            <span className="px-2 py-1 rounded-full bg-cream text-sm text-gold-primary">
              {normalizeArtPeriodLabel(artwork.period)}
            </span>
          </div>
        )}
        {artwork.tags && artwork.tags.length > 0 && (
          <div className="mt-3">
            <p className="text-sm text-gray-text mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {artwork.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded bg-divider text-xs text-gray-text"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {artwork.explanationText && (
          <div className="mt-4 space-y-2">
            <p className="text-dark-text text-sm leading-relaxed whitespace-pre-wrap">
              {artwork.explanationText}
            </p>
            {artwork.explanationAudioPcmBase64 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-cream text-xs text-gold-primary border border-gold-primary/40"
                onClick={() => {
                  stopDocentPlayback(
                    docentAudioContextRef,
                    docentAudioNextStartTimeRef,
                    docentPlayingSourcesRef
                  );
                  playPcmBase64(
                    artwork.explanationAudioPcmBase64!,
                    docentAudioContextRef,
                    docentAudioNextStartTimeRef,
                    docentPlayingSourcesRef
                  );
                }}
              >
                ▶ Play docent description
              </button>
            )}
          </div>
        )}

        {/* AI Guide transcript / status only when there is content to show */}
        {(status === "connecting" || status === "error" || inputTranscript || transcript) && (
          <div className="mt-4 p-3 rounded-xl bg-cream border border-gold-primary/20 min-h-[80px]">
            {status === "connecting" && (
              <p className="text-gray-text text-sm">Connecting to AI Guide…</p>
            )}
            {status === "error" && errorMessage && (
              <p className="text-red-600 text-sm">{errorMessage}</p>
            )}
            {inputTranscript && (
              <p className="text-gray-text text-sm mb-1">You: {inputTranscript}</p>
            )}
            {transcript && (
              <p className="text-dark-text text-sm leading-relaxed whitespace-pre-wrap">
                {transcript}
              </p>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[390px] -translate-x-1/2 p-4 border-t border-divider bg-white/95 backdrop-blur-sm shrink-0 z-10">
        <div className="space-y-2">
          <button
            ref={micButtonRef}
            type="button"
            className="w-full py-3 rounded-full bg-gold-primary text-white font-medium touch-none select-none active:opacity-90"
            onPointerDown={handlePressStart}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onPointerCancel={handlePressEnd}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Hold to speak to AI Guide"
          >
            {holdingMic
              ? "Speaking…"
              : status === "connecting" && liveActive
                ? "Connecting…"
                : "Hold to speak to AI Guide"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-2 rounded-full border border-divider text-sm text-gray-text hover:bg-divider"
          >
            Delete artwork
          </button>
        </div>
      </div>

      {photoViewerOpen && artwork.photos[0] && (
        <PhotoViewer
          imageSrc={artwork.photos[0]}
          title={artwork.title}
          onClose={() => setPhotoViewerOpen(false)}
        />
      )}
    </div>
  );
}
