import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { store } from "../context/AppContext";
import { api } from "../context/AppContext";
import { useApp } from "../context/AppContext";
import { EditMuseumSheet } from "../components/EditMuseumSheet";

type MuseumGalleryGridProps = {
  onOpenPhotoMenu: () => void;
};

export function MuseumGalleryGrid({ onOpenPhotoMenu }: MuseumGalleryGridProps) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { accessCode } = useApp();
  const session = sessionId ? store.getSession(sessionId) : undefined;
  const artworks = sessionId ? store.getArtworksBySession(sessionId) : [];
  const [ending, setEnding] = useState(false);
  const [editMuseumOpen, setEditMuseumOpen] = useState(false);

  const handleEndVisit = () => {
    if (!sessionId) return;
    setEnding(true);
    api
      .postSummary(
        sessionId,
        artworks.filter((a) => a.confirmed).map((a) => ({ title: a.title, artist: a.artist, explanationText: a.explanationText })),
        accessCode
      )
      .then(({ summaryText, sections }) => {
        store.setSummary({
          sessionId,
          summaryText,
          sections,
          createdAt: new Date().toISOString(),
        });
        store.updateSession(sessionId, { status: "completed", endedAt: new Date().toISOString() });
        navigate(`/visit/${sessionId}/summary`);
      })
      .catch(() => setEnding(false));
  };

  if (!sessionId || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-text">Session not found.</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="ml-2 text-gold-primary"
        >
          Go home
        </button>
      </div>
    );
  }

  const handleDeleteVisit = () => {
    if (!sessionId) return;
    const ok = window.confirm("Delete this visit and all its artworks from this device?");
    if (!ok) return;
    store.deleteSession(sessionId);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-[390px] mx-auto sm:shadow-lg">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-divider shrink-0">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="p-2 -ml-2 rounded-full hover:bg-divider"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 font-semibold text-dark-text truncate text-center">
          {session.museumName || "Museum visit"}
        </h1>
        <button
          type="button"
          onClick={handleDeleteVisit}
          className="p-2 rounded-full hover:bg-divider text-gray-text"
          aria-label="Delete visit"
        >
          🗑
        </button>
      </header>

      <div className="p-4 flex-1 pb-24">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-dark-text">
            {session.museumName || "Museum visit"}
          </span>
          <button
            type="button"
            onClick={() => setEditMuseumOpen(true)}
            className="p-1 rounded hover:bg-divider"
            aria-label="Edit museum"
          >
            ✎
          </button>
        </div>
        <p className="text-sm text-gray-text mb-4 flex items-center gap-2">
          <span aria-hidden>📅</span> Visited {new Date(session.startedAt).toLocaleDateString()}
          <span className="ml-2" aria-hidden>🖼</span> {artworks.length} artworks
        </p>
        <div className="grid grid-cols-3 gap-2">
          {artworks.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/visit/${sessionId}/artwork/${a.id}`)}
              className="aspect-square rounded-lg overflow-hidden bg-divider relative"
            >
              {a.photos[0] ? (
                <img
                  src={a.photos[0]}
                  alt={a.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-light-gray text-xs p-2">No image</span>
              )}
              {a.liked && (
                <span className="absolute top-1 right-1 text-heart" aria-label="Liked">
                  ♥
                </span>
              )}
            </button>
          ))}
        </div>
        {session.status === "active" && (
          <button
            type="button"
            onClick={handleEndVisit}
            disabled={ending}
            className="mt-6 w-full py-3 rounded-full border border-divider text-dark-text font-medium disabled:opacity-50"
          >
            {ending ? "Generating story…" : "End visit"}
          </button>
        )}
      </div>

      {session.status === "active" && (
        <button
          type="button"
          onClick={onOpenPhotoMenu}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-gold-primary text-white text-xl shadow-lg flex items-center justify-center"
          aria-label="Add photo"
        >
          📷
        </button>
      )}

      {editMuseumOpen && (
        <EditMuseumSheet
          currentMuseumName={session.museumName || ""}
          onSave={(name) => store.updateSession(sessionId!, { museumName: name })}
          onClose={() => setEditMuseumOpen(false)}
        />
      )}
    </div>
  );
}
