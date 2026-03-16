import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { api, store } from "./context/AppContext";
import { VisitHome } from "./pages/VisitHome";
import { PhotoMenu } from "./pages/PhotoMenu";
import { MuseumGalleryGrid } from "./pages/MuseumGalleryGrid";
import { Capture } from "./pages/Capture";
import { LiveIdentification } from "./pages/LiveIdentification";
import { ArtworkAnalysis } from "./pages/ArtworkAnalysis";
import { VisitSummary } from "./pages/VisitSummary";
import { FavoriteArtworks } from "./pages/FavoriteArtworks";
import { CollectionStats } from "./pages/CollectionStats";
import "./App.css";

function AccessCodeGate({
  onSubmit,
  error,
}: {
  onSubmit: (code: string) => void;
  error: string | null;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-xl font-semibold mb-2">MuSeeum</h1>
      <p className="text-neutral-400 text-sm mb-6 text-center max-w-sm">
        Enter the access code provided by the organizers, or open the judge link they gave you.
      </p>
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
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { accessCode, clearAccessCode, currentVisitSessionId } = useApp();
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);

  const openPhotoMenu = useCallback(() => setPhotoMenuOpen(true), []);
  const closePhotoMenu = useCallback(() => setPhotoMenuOpen(false), []);

  const handleTakePhoto = useCallback(() => {
    closePhotoMenu();
    if (currentVisitSessionId) {
      navigate(`/visit/${currentVisitSessionId}/capture`);
    } else {
      api.createSession(accessCode ?? undefined).then(
        ({ sessionId }) => {
          store.addSession({
            id: sessionId,
            startedAt: new Date().toISOString(),
            status: "active",
          });
          navigate(`/visit/${sessionId}/capture`);
        },
        (e) => {
          const msg = e instanceof Error ? e.message : "Failed to create session";
          if (msg === "Invalid or missing access code" || msg === "Access denied") {
            clearAccessCode("Invalid access code. Please use the link or code from the organizers.");
          }
        }
      );
    }
  }, [currentVisitSessionId, accessCode, closePhotoMenu, navigate, clearAccessCode]);

  const handleUpload = useCallback(
    (file: File) => {
      closePhotoMenu();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const ensureSession = (): Promise<string> => {
          if (currentVisitSessionId) return Promise.resolve(currentVisitSessionId);
          return api.createSession(accessCode ?? undefined).then(({ sessionId }) => {
            store.addSession({
              id: sessionId,
              startedAt: new Date().toISOString(),
              status: "active",
            });
            return sessionId;
          });
        };
        ensureSession().then(
          (sessionId) => {
            const id = crypto.randomUUID();
            store.addArtwork({
              id,
              sessionId,
              createdAt: new Date().toISOString(),
              photos: [dataUrl],
              title: "",
              confirmed: false,
            });
            navigate(`/visit/${sessionId}/identify?artworkId=${id}`);
          },
          (e) => {
            const msg = e instanceof Error ? e.message : "Failed";
            if (msg === "Invalid or missing access code" || msg === "Access denied") {
              clearAccessCode("Invalid access code.");
            }
          }
        );
      };
      reader.readAsDataURL(file);
    },
    [currentVisitSessionId, accessCode, closePhotoMenu, navigate, clearAccessCode]
  );

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <VisitHomeWithSessionId
              onOpenPhotoMenu={openPhotoMenu}
            />
          }
        />
        <Route
          path="/visit/:sessionId"
          element={
            <MuseumGalleryGridWithSessionId
              onOpenPhotoMenu={openPhotoMenu}
            />
          }
        />
        <Route path="/visit/:sessionId/capture" element={<Capture />} />
        <Route
          path="/visit/:sessionId/identify"
          element={<LiveIdentification />}
        />
        <Route
          path="/visit/:sessionId/artwork/:artworkId"
          element={<ArtworkAnalysis />}
        />
        <Route path="/visit/:sessionId/summary" element={<VisitSummary />} />
        <Route path="/favorites" element={<FavoriteArtworks />} />
        <Route path="/stats" element={<CollectionStats />} />
      </Routes>

      {photoMenuOpen && (
        <PhotoMenu
          onTakePhoto={handleTakePhoto}
          onUpload={handleUpload}
          onCancel={closePhotoMenu}
        />
      )}
    </>
  );
}

function VisitHomeWithSessionId({ onOpenPhotoMenu }: { onOpenPhotoMenu: () => void }) {
  const { setCurrentVisitSessionId } = useApp();
  useEffect(() => {
    setCurrentVisitSessionId(null);
  }, [setCurrentVisitSessionId]);
  return <VisitHome onOpenPhotoMenu={onOpenPhotoMenu} />;
}

function MuseumGalleryGridWithSessionId({ onOpenPhotoMenu }: { onOpenPhotoMenu: () => void }) {
  const { setCurrentVisitSessionId } = useApp();
  const { sessionId } = useParams<{ sessionId: string }>();
  useEffect(() => {
    setCurrentVisitSessionId(sessionId ?? null);
  }, [sessionId, setCurrentVisitSessionId]);
  return <MuseumGalleryGrid onOpenPhotoMenu={onOpenPhotoMenu} />;
}

function AppRoot() {
  const { accessCode, persistAccessCode, gateError } = useApp();
  if (!accessCode) {
    return <AccessCodeGate onSubmit={persistAccessCode} error={gateError} />;
  }
  return <AppContent />;
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoot />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
