import { Link, useLocation } from "react-router-dom";

export function BottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const isVisitsActive = path === "/" || path.startsWith("/visit/");

  const linkBase =
    "flex flex-col items-center justify-center gap-1 flex-1 py-2 min-w-0 text-xs font-medium";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-divider flex items-center justify-around h-[84px] max-w-[390px] mx-auto pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <Link
        to="/"
        className={`${linkBase} ${!isVisitsActive ? "text-gold-dark" : "text-gray-text"}`}
        aria-current={path === "/" && !path.startsWith("/visit/") ? "page" : undefined}
      >
        <span className="text-xl leading-none" aria-hidden>◇</span>
        <span>Discover</span>
      </Link>
      <Link
        to="/"
        className={`${linkBase} text-gray-text`}
      >
        <span className="text-xl leading-none" aria-hidden>▣</span>
        <span>Map</span>
      </Link>
      <Link
        to="/"
        className={`${linkBase} ${isVisitsActive ? "text-dark-text font-bold" : "text-gray-text"}`}
        aria-current={isVisitsActive ? "page" : undefined}
      >
        <span className="text-xl leading-none" aria-hidden>◎</span>
        <span>Visits</span>
      </Link>
      <Link
        to="/"
        className={`${linkBase} text-gray-text`}
      >
        <span className="text-xl leading-none" aria-hidden>○</span>
        <span>Profile</span>
      </Link>
    </nav>
  );
}
