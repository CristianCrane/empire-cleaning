// PROTOTYPE: throwaway (#96). Ways to ask the type of home on the quote
// form's first step, flipped with ?home=A|B|C|D|E. Lives only on the
// prototype-home-type branch.
import { useEffect, useState } from "react";

export const variants = [
  { key: "A", name: "Two segmented controls" },
  { key: "B", name: "Icon tiles" },
  { key: "C", name: "Icon pills" },
  { key: "D", name: "Plain radios" },
  { key: "E", name: "One question, icon tiles" },
];

const read = () =>
  (typeof window === "undefined"
    ? "A"
    : (new URLSearchParams(window.location.search).get("home") ?? "A")
  ).toUpperCase();

const write = (key: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set("home", key);
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event("prototype-variant"));
};

export function useHomeVariant() {
  const [key, setKey] = useState(read);
  useEffect(() => {
    const update = () => setKey(read());
    window.addEventListener("prototype-variant", update);
    return () => window.removeEventListener("prototype-variant", update);
  }, []);
  return key;
}

// a floating bar: ‹ variant ›; arrow keys flip too
export function PrototypeSwitcher({ current }: { current: string }) {
  const index = Math.max(
    variants.findIndex((v) => v.key === current),
    0,
  );
  const step = (by: number) =>
    write(variants[(index + by + variants.length) % variants.length]!.key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-fg px-2 py-1 text-sm text-bg shadow-lg">
      <button
        type="button"
        className="rounded-full px-2 py-1.5 hover:opacity-70"
        aria-label="Previous variant"
        onClick={() => step(-1)}
      >
        ‹
      </button>
      <span className="whitespace-nowrap font-semibold">
        {variants[index]!.key} ({variants[index]!.name})
      </span>
      <button
        type="button"
        className="rounded-full px-2 py-1.5 hover:opacity-70"
        aria-label="Next variant"
        onClick={() => step(1)}
      >
        ›
      </button>
    </div>
  );
}
