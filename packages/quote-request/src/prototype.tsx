// PROTOTYPE: throwaway (#96). Variants of the quote form, flipped with
// ?variant=A|B|C|D and ?fields=soft, on the landing page and in the app.
// Lives only on the prototype-quote-form branch.
import { useEffect, useState, type ReactNode } from "react";

export const variants = [
  { key: "A", name: "Current" },
  { key: "B", name: "Quiet choices" },
  { key: "C", name: "Quiet + tuck optional" },
  { key: "D", name: "Steps" },
];

export type Variant = {
  key: string;
  // segmented controls and chips instead of radio boxes and checkboxes
  quiet: boolean;
  // optional fields behind "+ Add …" until used
  tuck: boolean;
  // one group per screen, with Back and Next
  steps: boolean;
  // borderless, tinted text fields
  soft: boolean;
};

const read = (): Variant => {
  const search = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  );
  const key = (search.get("variant") ?? "A").toUpperCase();
  return {
    key,
    quiet: key !== "A",
    tuck: key === "C" || key === "D",
    steps: key === "D",
    soft: search.get("fields") === "soft",
  };
};

const write = (change: Record<string, string | null>) => {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(change)) {
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event("prototype-variant"));
};

export function useVariant() {
  const [variant, setVariant] = useState(read);
  useEffect(() => {
    const update = () => setVariant(read());
    window.addEventListener("prototype-variant", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("prototype-variant", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return variant;
}

// a floating bar: ‹ variant › and a soft fields toggle; arrow keys flip too
export function PrototypeSwitcher({ variant }: { variant: Variant }) {
  const index = Math.max(
    variants.findIndex((v) => v.key === variant.key),
    0,
  );
  const step = (by: number) =>
    write({
      variant: variants[(index + by + variants.length) % variants.length]!.key,
    });

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
      <button
        type="button"
        className="ml-1 whitespace-nowrap rounded-full border border-bg/40 px-2.5 py-1 hover:opacity-70"
        aria-pressed={variant.soft}
        onClick={() => write({ fields: variant.soft ? null : "soft" })}
      >
        {variant.soft ? "Soft fields ✓" : "Soft fields"}
      </button>
    </div>
  );
}

// the soft field style: no outline until focused, on a tinted ground
export function SoftFields({
  on,
  children,
}: {
  on: boolean;
  children: ReactNode;
}) {
  return (
    <div data-soft={on || undefined} className="contents">
      {children}
    </div>
  );
}

// an optional field, tucked behind a "+ Add …" link until it's wanted or
// already has something in it
export function Optional({
  tuck,
  add,
  hasValue,
  children,
}: {
  tuck: boolean;
  add: string;
  hasValue: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!tuck || open || hasValue) return children;
  return (
    <button
      type="button"
      className="self-start rounded text-sm font-semibold text-primary hover:underline"
      onClick={() => setOpen(true)}
    >
      + {add}
    </button>
  );
}
