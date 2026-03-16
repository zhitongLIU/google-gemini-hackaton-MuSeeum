type PhotoViewerProps = {
  imageSrc: string;
  title?: string;
  onClose: () => void;
};

export function PhotoViewer({ imageSrc, title, onClose }: PhotoViewerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
          aria-label="Close"
        >
          ✕
        </button>
        <span className="text-white font-medium truncate flex-1 text-center mx-2">
          {title || "Photo"}
        </span>
        <div className="w-10" />
      </header>
      <main className="flex-1 flex items-center justify-center p-4 min-h-0">
        <img
          src={imageSrc}
          alt={title || "Artwork"}
          className="max-w-full max-h-full object-contain"
        />
      </main>
    </div>
  );
}
