import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "../context/AppContext";

type VisitHomeProps = {
  onOpenPhotoMenu: () => void;
};

export function VisitHome({ onOpenPhotoMenu }: VisitHomeProps) {
  const navigate = useNavigate();
  const sessions = store.listSessions();
  const hasVisits = sessions.length > 0;

  // Precompute up to 5 artwork thumbnails per session for the carousel gallery
  const sessionThumbnails = useMemo(() => {
    const result: Record<string, string[]> = {};
    sessions.forEach((s) => {
      const arts = store.getArtworksBySession(s.id)
        .filter((a) => a.photos[0])
        .slice(0, 5);
      if (arts.length) {
        result[s.id] = arts.map((a) => a.photos[0]!);
      }
    });
    return result;
  }, [sessions]);

  // Global tick so each visit card auto-rotates its image
  const [carouselTick, setCarouselTick] = useState(0);
  useEffect(() => {
    if (!hasVisits) return;
    const id = window.setInterval(() => {
      setCarouselTick((t) => t + 1);
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasVisits]);

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-[390px] mx-auto sm:shadow-lg">
      {/* Top bar: city | logo | avatar — per Tu4DF */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 border-b border-divider shrink-0 h-[72px]">
        <span className="text-gray-text text-base font-medium text-left truncate">
          {hasVisits ? "MuSeeum" : ""}
        </span>
        <h1 className="text-dark-text font-bold text-sm text-center font-serif flex items-center gap-1">
          <span aria-hidden className="text-gold-primary">◇</span>
          MuSeeum
        </h1>
        <div
          className="w-10 h-10 rounded-full bg-divider flex items-center justify-center justify-self-end text-dark-text text-sm font-semibold"
          aria-hidden
        >
          —
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 py-4 pb-32">
        {!hasVisits ? (
          /* Tu4DF Empty state */
          <div className="flex flex-col items-center gap-6 w-full max-w-[320px] mx-auto mt-10">
            <div className="w-[120px] h-[120px] rounded-full bg-cream flex items-center justify-center flex-shrink-0">
              <span className="text-gold-light text-4xl" aria-hidden>🖼</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="font-serif font-bold text-2xl text-dark-text">
                No Visits Yet
              </h2>
              <p className="text-gray-text text-sm leading-relaxed">
                Start exploring museums and your gallery will fill with amazing artworks from your visits.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPhotoMenu}
              className="min-w-[200px] h-12 px-6 rounded-full font-semibold text-base text-white bg-gold-primary touch-manipulation shadow-md hover:opacity-95 active:opacity-90 transition-opacity"
            >
              Start Exploring
            </button>
          </div>
        ) : (
          <>
            {/* Carousel gallery of recent visits — mV2A11 */}
            <section className="w-full overflow-x-auto pb-2 -mx-2 px-2">
              <div className="flex gap-4 snap-x snap-mandatory">
                {sessions.slice(0, 5).map((s) => {
                  const thumbs = sessionThumbnails[s.id] ?? [];
                  const currentImage =
                    thumbs.length > 0 ? thumbs[Math.abs(carouselTick) % thumbs.length] : null;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => navigate(`/visit/${s.id}`)}
                      className="snap-center shrink-0 w-[262px] rounded-2xl border border-divider bg-white shadow-sm text-left overflow-hidden"
                    >
                      {currentImage && (
                        <div className="h-40 bg-black/5 overflow-hidden">
                          <img
                            src={currentImage}
                            alt={s.museumName || "Artwork from visit"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4 space-y-2">
                        <p className="text-xs text-gray-text uppercase tracking-wide">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </p>
                        <p className="font-semibold text-dark-text line-clamp-2">
                          {s.museumName || "Museum visit"}
                        </p>
                        <p className="text-xs text-gray-text">
                          {s.status === "completed" ? "Completed visit" : "In progress"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Discovery menu as bottom nav — l1C5K */}
            <section className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 border-t border-divider px-4 pt-3 pb-[env(safe-area-inset-bottom)] max-w-[390px] mx-auto space-y-3">
              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/favorites")}
                  className="flex-1 px-3 py-2 rounded-2xl bg-cream flex flex-col items-center justify-center text-xs font-medium text-dark-text"
                >
                  <span aria-hidden className="text-lg mb-1">★</span>
                  <span className="text-center leading-tight">
                    Favorite<br />Artworks
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onOpenPhotoMenu}
                  className="flex-1 px-3 py-2 rounded-2xl bg-cream flex flex-col items-center justify-center text-xs font-medium text-dark-text"
                >
                  <span aria-hidden className="text-lg mb-1">🧭</span>
                  <span className="text-center leading-tight">
                    New<br />Visit
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/stats")}
                  className="flex-1 px-3 py-2 rounded-2xl bg-cream flex flex-col items-center justify-center text-xs font-medium text-dark-text"
                >
                  <span aria-hidden className="text-lg mb-1">📊</span>
                  <span className="text-center leading-tight">
                    Collection<br />Stats
                  </span>
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
