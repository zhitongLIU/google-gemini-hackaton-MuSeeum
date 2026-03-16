import { useRef } from "react";

type PhotoMenuProps = {
  onTakePhoto: () => void;
  onUpload: (file: File) => void;
  onCancel: () => void;
};

export function PhotoMenu({ onTakePhoto, onUpload, onCancel }: PhotoMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onCancel}
        aria-hidden
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-6 pb-safe shadow-lg max-w-[390px] mx-auto">
        <h2 className="text-lg font-semibold text-dark-text mb-1">Add artwork</h2>
        <p className="text-sm text-gray-text mb-4">Take a photo or choose from gallery.</p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onTakePhoto}
            className="w-full py-3 rounded-xl bg-gold-primary text-white font-medium touch-manipulation"
          >
            Take a Photo
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full py-3 rounded-xl border border-divider text-dark-text font-medium touch-manipulation"
          >
            Upload from Gallery
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-gray-text text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
