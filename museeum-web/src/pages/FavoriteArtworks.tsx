import { useNavigate } from "react-router-dom";
import { store } from "../context/AppContext";

export function FavoriteArtworks() {
  const navigate = useNavigate();
  const favorites = store.getFavoriteArtworks();

  const museumCount = new Set(favorites.map((a) => a.museumName).filter(Boolean)).size;

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
        <h1 className="flex-1 font-semibold text-dark-text">Favorite Artworks</h1>
      </header>

      <main className="flex-1 p-4 overflow-auto">
        <p className="font-medium text-dark-text mb-0.5">
          {favorites.length} Favorite Artwork{favorites.length === 1 ? "" : "s"}
        </p>
        <p className="text-gray-text text-sm mb-4">Across {museumCount} museum{museumCount === 1 ? "" : "s"}</p>
        <div className="grid grid-cols-3 gap-2">
          {favorites.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/visit/${a.sessionId}/artwork/${a.id}`)}
              className="aspect-square rounded-lg overflow-hidden bg-divider relative"
            >
              {a.photos[0] ? (
                <img src={a.photos[0]} alt={a.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-light-gray text-xs p-2">No image</span>
              )}
              <span className="absolute top-1 right-1 text-heart">♥</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
