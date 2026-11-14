// PROTOTYPE: throwaway. A floating bar for flipping between UI variants of a
// page via ?variant=. Lives only on prototype-* branches.
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
  keys = ["ArrowLeft", "ArrowRight"],
  className = "bottom-24 md:bottom-4",
}: {
  variants: { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
  // the keys that step back and forward, and where the bar sits
  keys?: [string, string];
  className?: string;
}) {
  const index = Math.max(
    variants.findIndex((v) => v.key === current),
    0,
  );
  const step = (by: number) =>
    onChange(variants[(index + by + variants.length) % variants.length]!.key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      if (e.key === keys[0]) step(-1);
      if (e.key === keys[1]) step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!import.meta.env.DEV) return null;
  const variant = variants[index]!;
  return (
    <div
      className={`fixed ${className} left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-fg px-2 py-1 text-sm text-bg shadow-lg`}
    >
      <button
        type="button"
        className="rounded-full p-2 hover:opacity-70"
        aria-label="Previous variant"
        onClick={() => step(-1)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span className="whitespace-nowrap font-semibold">
        {variant.key} ({variant.name})
      </span>
      <button
        type="button"
        className="rounded-full p-2 hover:opacity-70"
        aria-label="Next variant"
        onClick={() => step(1)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
