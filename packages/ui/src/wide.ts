import { useSyncExternalStore } from "react";

// from md (48rem, a tablet), where an Office list's rows become a Table
// and the Schedule has room for a week: Tailwind's `md`, written once for
// what reads it in code
const WIDE = "(min-width: 48rem)";

// whether the screen is that wide now, read once (where to start)
export const isWide = () =>
  typeof window === "undefined" || window.matchMedia(WIDE).matches;

const watch = (change: () => void) => {
  const media = window.matchMedia(WIDE);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
};

// the same, kept up to date as the window is resized or turned
export const useWide = () => useSyncExternalStore(watch, isWide);
