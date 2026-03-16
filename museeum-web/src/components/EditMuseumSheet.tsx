import { useState } from "react";

type EditMuseumSheetProps = {
  currentMuseumName: string;
  onSave: (name: string) => void;
  onClose: () => void;
};

const SUGGESTED = [
  "National Gallery, London",
  "The Louvre",
  "Musée d'Orsay",
  "Metropolitan Museum of Art",
  "British Museum",
];

export function EditMuseumSheet({ currentMuseumName, onSave, onClose }: EditMuseumSheetProps) {
  const [value, setValue] = useState(currentMuseumName);
  const [search, setSearch] = useState("");

  const filtered = SUGGESTED.filter(
    (m) => !search || m.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-6 pb-safe shadow-lg max-w-[390px] mx-auto max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark-text">Edit Museum</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-divider"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-text mb-2">Current</p>
        <div className="p-3 rounded-xl border-2 border-gold-primary bg-cream mb-4">
          <span className="text-dark-text font-medium">{currentMuseumName || "—"}</span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a museum"
          className="w-full px-4 py-3 rounded-xl border border-divider text-dark-text placeholder-light-gray mb-4"
        />
        <div className="flex-1 overflow-auto space-y-2">
          {filtered.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setValue(m);
                onSave(m);
                onClose();
              }}
              className="w-full p-3 rounded-xl border border-divider text-left text-dark-text hover:bg-cream"
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Or type museum name"
          className="mt-2 w-full px-4 py-2 rounded-lg border border-divider text-sm text-dark-text"
        />
        <button
          type="button"
          onClick={() => {
            if (value.trim()) {
              onSave(value.trim());
              onClose();
            }
          }}
          className="mt-4 w-full py-3 rounded-full bg-gold-primary text-white font-medium"
        >
          Save
        </button>
      </div>
    </>
  );
}
