import { useNavigate } from "react-router-dom";
import { store } from "../context/AppContext";

const NOT_IDENTIFIABLE = "Not identifiable from the image";

export function CollectionStats() {
  const navigate = useNavigate();
  const sessions = store.listSessions();
  const artworks = store.getMuseeumData().artworks;
  const museums = [...new Set(sessions.map((s) => s.museumName).filter(Boolean))] as string[];
  const byMuseum = museums.map((m) => ({
    name: m,
    count: artworks.filter((a) => a.museumName === m).length,
  }));
  const byPeriod: Record<string, number> = {};
  artworks.forEach((a) => {
    if (a.period && a.period !== NOT_IDENTIFIABLE) {
      byPeriod[a.period] = (byPeriod[a.period] ?? 0) + 1;
    }
  });
  const periodList = Object.entries(byPeriod).sort((a, b) => b[1] - a[1]);
  const byArtist: Record<string, number> = {};
  artworks.forEach((a) => {
    const raw = a.artist?.trim();
    if (!raw || raw === NOT_IDENTIFIABLE) return;
    const name = raw;
    byArtist[name] = (byArtist[name] ?? 0) + 1;
  });
  const artistList = Object.entries(byArtist).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-divider shrink-0">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="p-2 -ml-2 rounded-full hover:bg-divider"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 font-semibold text-dark-text">Collection Stats</h1>
      </header>

      <main className="flex-1 overflow-auto p-4 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-cream text-center">
            <p className="text-2xl font-semibold text-gold-primary">{museums.length || sessions.length}</p>
            <p className="text-xs text-gray-text">Museums</p>
          </div>
          <div className="p-4 rounded-xl bg-divider text-center">
            <p className="text-2xl font-semibold text-dark-text">{artworks.length}</p>
            <p className="text-xs text-gray-text">Artworks</p>
          </div>
          <div className="p-4 rounded-xl bg-cream text-center">
            <p className="text-2xl font-semibold text-gold-primary">{artworks.filter((a) => a.liked).length}</p>
            <p className="text-xs text-gray-text">Favorites</p>
          </div>
        </div>

        {byMuseum.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-dark-text mb-2">Artworks per Museum</h2>
            <div className="space-y-2">
              {byMuseum.map(({ name, count }) => (
                <div key={name} className="flex justify-between items-center">
                  <span className="text-sm text-gray-text truncate flex-1">{name}</span>
                  <span className="text-sm font-medium text-dark-text ml-2">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {periodList.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-dark-text mb-2">Art Periods</h2>
            <div className="space-y-2">
              {periodList.map(([period, count], i) => (
                <div key={period} className="flex justify-between items-center">
                  <span className="text-sm text-gray-text">{i + 1}. {period}</span>
                  <span className="px-2 py-0.5 rounded-full bg-cream text-gold-primary text-xs font-medium">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {artistList.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-dark-text mb-2">Top Artists</h2>
            <div className="space-y-2">
              {artistList.map(([artist, count], i) => (
                <div key={artist} className="flex justify-between items-center text-sm">
                  <span className="text-gray-text">#{i + 1} {artist}</span>
                  <span className="text-dark-text">{count} artworks</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
