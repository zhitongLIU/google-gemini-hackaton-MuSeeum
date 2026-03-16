import { useParams, useNavigate } from "react-router-dom";
import { store } from "../context/AppContext";
import { useApp } from "../context/AppContext";
import { useLiveSession } from "../hooks/useLiveSession";

export function LiveVisit() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { accessCode } = useApp();
  const { status, errorMessage, transcript, inputTranscript } = useLiveSession(
    sessionId ?? null,
    accessCode
  );
  const session = sessionId ? store.getSession(sessionId) : undefined;
  const artworks = sessionId ? store.getArtworksBySession(sessionId) : [];
  const lastArtwork = artworks.filter((a) => a.confirmed).pop();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col max-w-[390px] mx-auto">
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(sessionId ? `/visit/${sessionId}` : "/")}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 font-semibold">Live AI Guide</h1>
      </header>

      <main className="flex-1 flex flex-col p-4">
        <p className="text-light-gray text-sm mb-4">
          {session?.museumName || "Museum visit"}
          {lastArtwork && ` · Last: ${lastArtwork.title}`}
        </p>
        <p className="text-light-gray text-xs mb-2">
          {status === "connecting" && "Connecting…"}
          {status === "ready" && "Tap the mic and ask a question."}
          {status === "disconnected" && "Disconnected."}
          {status === "error" && (errorMessage || "Error")}
        </p>
        <div className="flex-1 min-h-[120px] p-3 rounded-lg bg-black/40 text-sm space-y-2 overflow-auto">
          {inputTranscript && <p className="text-light-gray">You: {inputTranscript}</p>}
          {transcript && <p className="text-white">{transcript}</p>}
        </div>
      </main>
    </div>
  );
}
