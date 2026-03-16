import { useParams, useNavigate } from "react-router-dom";
import { store } from "../context/AppContext";

export function VisitSummary() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const session = sessionId ? store.getSession(sessionId) : undefined;
  const summary = sessionId ? store.getSummary(sessionId) : undefined;

  if (!sessionId || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-text">Session not found.</p>
        <button type="button" onClick={() => navigate("/")} className="ml-2 text-gold-primary">
          Go home
        </button>
      </div>
    );
  }

  const handleDownloadHTML = () => {
    const artworks = store.getArtworksBySession(sessionId);
    const s = summary ?? { summaryText: "", sections: [] };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>MuSeeum – ${session.museumName || "Visit"}</title></head><body style="font-family:Georgia,serif;max-width:720px;margin:0 auto;padding:24px;">
<h1>${session.museumName || "Museum visit"}</h1>
<p><em>${new Date(session.startedAt).toLocaleDateString()}</em></p>
<div style="white-space:pre-wrap;margin:24px 0;">${s.summaryText}</div>
${s.sections.map((sec) => `<h2>${sec.artworkTitle}</h2><p><strong>${sec.artist ?? ""}</strong></p><p>${sec.shortStory}</p>`).join("")}
${artworks.map((a) => a.photos[0] ? `<figure><img src="${a.photos[0]}" alt="${a.title}" style="max-width:100%;height:auto;" /><figcaption>${a.title} – ${a.artist ?? ""}</figcaption></figure>` : "").join("")}
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `museeum-${sessionId.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <h1 className="flex-1 font-semibold text-dark-text">Visit Summary</h1>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <h2 className="text-lg font-medium text-dark-text mb-2">{session.museumName || "Museum visit"}</h2>
        <p className="text-sm text-gray-text mb-4">{new Date(session.startedAt).toLocaleDateString()}</p>
        {summary ? (
          <>
            <div className="whitespace-pre-wrap text-dark-text leading-relaxed mb-6">
              {summary.summaryText}
            </div>
            {summary.sections.length > 0 && (
              <div className="space-y-4 mb-6">
                {summary.sections.map((sec, i) => (
                  <div key={i}>
                    <h3 className="font-medium text-dark-text">{sec.artworkTitle}</h3>
                    {sec.artist && <p className="text-sm text-gold-dark">{sec.artist}</p>}
                    <p className="text-gray-text text-sm">{sec.shortStory}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-text">No summary generated yet.</p>
        )}
      </main>

      <div className="p-4 border-t border-divider flex gap-3">
        <button
          type="button"
          onClick={handleDownloadHTML}
          className="flex-1 py-3 rounded-full bg-gold-primary text-white font-medium"
        >
          Download as HTML
        </button>
      </div>
    </div>
  );
}
