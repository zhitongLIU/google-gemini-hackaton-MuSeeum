import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { store } from "../context/AppContext";
import { api } from "../context/AppContext";
import { useApp } from "../context/AppContext";
import type { ArtInfoCandidate } from "../lib/api";

type LiveIdentificationProps = {
  imageDataUrl?: string | null;
  artworkId?: string | null;
};

export function LiveIdentification({ imageDataUrl: imageProp, artworkId: artworkIdProp }: LiveIdentificationProps) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessCode } = useApp();
  const artworkIdFromQuery = searchParams.get("artworkId");
  const artworkId = artworkIdProp ?? artworkIdFromQuery ?? null;

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(imageProp ?? null);
  const [loading, setLoading] = useState(!!imageDataUrl && !!sessionId);
  const [candidate, setCandidate] = useState<ArtInfoCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typedTitle, setTypedTitle] = useState("");
  const [showTypeInput, setShowTypeInput] = useState(false);

  // Live agent is not used on the identification screen; docent speaks on the artwork page after confirmation.

  // Load artwork from store if we have artworkId
  useEffect(() => {
    if (artworkId && !imageDataUrl) {
      const a = store.getArtwork(artworkId);
      if (a?.photos[0]) {
        setImageDataUrl(a.photos[0]);
        if (a.candidate) {
          setCandidate(a.candidate);
          setLoading(false);
        }
      }
    }
  }, [artworkId, imageDataUrl]);

  // Call Art Info Agent when we have session + image
  useEffect(() => {
    if (!sessionId || !imageDataUrl || candidate) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const base64 = imageDataUrl.includes(",") ? imageDataUrl : `data:image/jpeg;base64,${imageDataUrl}`;
    api
      .postArtwork(sessionId, base64, accessCode)
      .then(({ candidate: c }) => {
        if (!cancelled) {
          setCandidate(c);
          setLoading(false);
          if (artworkId) {
            store.updateArtwork(artworkId, { candidate: c });
          }
          if (c.museum) {
            store.updateSession(sessionId, { museumName: c.museum });
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Identification failed");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, imageDataUrl, accessCode, candidate, artworkId]);

  const confirm = (payload: { title: string; artist?: string; period?: string; year?: string; museumName?: string }) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    api
      .confirmArtwork(sessionId, payload, accessCode)
      .then((result) => {
        const idToUse = artworkId ?? result.artworkId;
        const photos = imageDataUrl ? [imageDataUrl] : (artworkId ? store.getArtwork(artworkId)?.photos ?? [] : []);
        if (artworkId) {
          store.updateArtwork(artworkId, {
            title: result.title,
            artist: result.artist,
            period: payload.period,
            year: payload.year,
            museumName: payload.museumName,
            explanationText: result.explanationText,
            sections: result.sections,
            tags: result.tags,
            explanationAudioPcmBase64: result.audioPcmBase64,
            confirmed: true,
            confirmationSource: "typed",
            photos: photos.length ? photos : undefined,
          });
        } else {
          store.addArtwork({
            id: result.artworkId,
            sessionId,
            createdAt: new Date().toISOString(),
            photos,
            title: result.title,
            artist: result.artist,
            period: payload.period,
            year: payload.year,
            museumName: payload.museumName,
            explanationText: result.explanationText,
            sections: result.sections,
            tags: result.tags,
            explanationAudioPcmBase64: result.audioPcmBase64,
            confirmed: true,
            confirmationSource: "typed",
          });
        }
        navigate(`/visit/${sessionId}/artwork/${idToUse}`);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Confirm failed");
        setLoading(false);
      });
  };

  const handleConfirmFromCandidate = () => {
    if (!candidate) return;
    confirm({
      title: candidate.title,
      artist: candidate.artist,
      period: candidate.period,
      year: candidate.year,
      museumName: candidate.museum,
    });
  };

  const handleTypedSubmit = () => {
    const title = typedTitle.trim();
    if (!title) return;
    confirm({
      title,
      artist: candidate?.artist,
      period: candidate?.period,
      year: candidate?.year,
      museumName: candidate?.museum,
    });
  };

  // 5s auto-confirm
  useEffect(() => {
    if (!candidate || showTypeInput) return;
    const id = setTimeout(() => {
      if (!candidate) return;
      confirm({
        title: candidate.title,
        artist: candidate.artist,
        period: candidate.period,
        year: candidate.year,
        museumName: candidate.museum,
      });
    }, 5000);
    return () => clearTimeout(id);
  }, [candidate, showTypeInput]);

  const goBack = () => {
    if (sessionId) navigate(`/visit/${sessionId}`);
    else navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col max-w-[390px] mx-auto">
      <header className="flex items-center gap-3 px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={goBack}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 font-semibold text-center">Live Identification</h1>
      </header>

      {imageDataUrl && (
        <div className="px-4 mb-4">
          <div className="aspect-[4/3] max-h-[250px] rounded-xl overflow-hidden bg-black/40">
            <img src={imageDataUrl} alt="Captured" className="w-full h-full object-contain" />
          </div>
          {loading && (
            <p className="text-center text-gold-light text-sm mt-2 flex items-center justify-center gap-1">
              <span aria-hidden>✨</span> AI Analyzing...
            </p>
          )}
        </div>
      )}

      <div className="flex-1 px-4 space-y-4">
        {candidate && (
          <div className="rounded-xl bg-black/30 p-4">
            <p className="text-light-gray text-sm mb-1">I think this is...</p>
            <p className="text-2xl font-serif text-gold-light">{candidate.title}</p>
            <p className="text-gold-dark">by {candidate.artist}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {candidate.year && (
                <span className="px-2 py-1 rounded-full bg-black/40 text-xs">{candidate.year}</span>
              )}
              {candidate.museum && (
                <span className="px-2 py-1 rounded-full bg-black/40 text-xs">{candidate.museum}</span>
              )}
              {candidate.period && (
                <span className="px-2 py-1 rounded-full bg-gold-primary/30 text-xs text-gold-light">
                  {candidate.period}
                </span>
              )}
            </div>
            <p className="text-light-gray text-xs mt-2">Confirm to continue — the docent will talk about this artwork on the next page.</p>
          </div>
        )}

        {showTypeInput ? (
          <div className="space-y-2">
            <input
              type="text"
              value={typedTitle}
              onChange={(e) => setTypedTitle(e.target.value)}
              placeholder="Enter artwork title"
              className="w-full px-4 py-3 rounded-lg bg-black/40 border border-gray-text text-white placeholder-light-gray"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTypedSubmit}
                className="flex-1 py-2 rounded-full bg-gold-primary text-white font-medium"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setShowTypeInput(false)}
                className="py-2 px-4 text-light-gray text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          candidate && (
            <button
              type="button"
              onClick={() => setShowTypeInput(true)}
              className="text-gold-light text-sm underline"
            >
              Or type it myself
            </button>
          )
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      {candidate && !showTypeInput && (
        <div className="p-4 flex flex-col items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleConfirmFromCandidate}
            className="w-full py-3 rounded-full bg-gold-primary text-white font-medium shadow-[0_0_24px_rgba(176,138,31,0.3)]"
          >
            Confirm & continue
          </button>
          <span className="text-light-gray text-xs">Or wait 5 seconds to auto-confirm</span>
        </div>
      )}
    </div>
  );
}
