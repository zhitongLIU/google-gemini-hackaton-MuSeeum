import { useParams, useNavigate } from "react-router-dom";
import { CameraView } from "../components/CameraView";
import { store } from "../context/AppContext";

export function Capture() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const session = sessionId ? store.getSession(sessionId) : undefined;

  if (!sessionId || !session) {
    navigate("/", { replace: true });
    return null;
  }

  const handleCapture = (dataUrl: string) => {
    const id = crypto.randomUUID();
    store.addArtwork({
      id,
      sessionId,
      createdAt: new Date().toISOString(),
      photos: [dataUrl],
      title: "",
      confirmed: false,
    });
    navigate(`/visit/${sessionId}/identify?artworkId=${id}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col w-full max-w-[390px] mx-auto sm:shadow-lg">
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(`/visit/${sessionId}`)}
          className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 font-semibold text-white">Capture artwork</h1>
      </header>
      <main className="flex-1 flex flex-col items-center px-4 py-4 pb-8">
        <div className="w-full flex-1 flex items-center justify-center">
          <CameraView
            onFrameCapture={handleCapture}
            buttonLabel="Capture"
            videoEnabled
            audioEnabled={false}
          />
        </div>
      </main>
    </div>
  );
}
