import { useRef, useEffect, useState, useCallback } from "react";

type Props = {
  onFrameCapture?: (dataUrl: string) => void;
  buttonLabel?: string;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
};

export function CameraView({
  onFrameCapture,
  buttonLabel = "Describe this",
  videoEnabled = true,
  audioEnabled = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");

  const startCamera = useCallback(async () => {
    setError(null);
    setStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled ? { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: audioEnabled,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus("ready");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not access camera or microphone";
      setError(message);
      setStatus("idle");
    }
  }, [videoEnabled, audioEnabled]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onFrameCapture?.(dataUrl);
  }, [onFrameCapture]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-4 bg-black/80 text-white rounded-lg">
        <p className="text-center">{error}</p>
        <button
          type="button"
          onClick={startCamera}
          className="px-4 py-2 bg-white text-black rounded-full font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/3] max-h-[70vh] bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
          Loading camera…
        </div>
      )}
      {onFrameCapture && status === "ready" && (
        <button
          type="button"
          onClick={captureFrame}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/90 text-black rounded-full font-medium shadow-lg"
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}
