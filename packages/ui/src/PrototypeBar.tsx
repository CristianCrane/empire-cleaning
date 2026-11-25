import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Link, type LinkProps } from "react-aria-components";
import { ChevronLeft, ChevronRight, LayoutGrid, Minus } from "lucide-react";
import { readStored, store } from "./stored.ts";

// one of a prototype's layouts or cases, and the link that draws it
type Choice = { key: string; name: string; href: LinkProps["href"] };

// the arrow keys, and which link each presses
const STEPS: Record<string, string> = {
  ArrowUp: "layout-back",
  ArrowDown: "layout-on",
  ArrowLeft: "case-back",
  ArrowRight: "case-on",
};

// whether the bar is folded to its pill, kept across the pages a person
// steps through (the landing site's are each a page load); a browser that
// keeps nothing starts it open
const FOLDED = "prototype-bar-folded";

// The bar a prototype is looked at with (docs/ux.md, Changing a screen): the
// layout and the case on show, links to the one before and after each,
// pressed by ↑/↓ (layouts) and ←/→ (cases) unless a field has the keys or a
// modifier is held (Alt+← is the browser's Back), and a link to the list of
// them all. The web app's prototype shell and the landing site's prototype
// page each place it once, in the bottom left corner, above all a case draws
// (a dialog's backdrop, a bank's pop-up), and in React Aria's top layer, as
// the toasts are, which an open dialog leaves pressable, so a press reaches
// it as the keys do. It covers what's under it, so it folds to a pill
// naming the layout and case, and the keys still step. It's drawn in the
// browser alone (the landing site's client:only). Its links go through the
// web app's router there, and are plain links on the landing site. Each
// places it in development alone (import.meta.env.DEV): an e2e run, and so
// `pnpm pr:shots --prototype`, serves a production build, so the shots have
// the screen alone
export function PrototypeBar({
  layouts,
  cases,
  layout,
  case: shown,
  index,
}: {
  layouts: Choice[];
  cases: Choice[];
  layout: string;
  case: string;
  index: LinkProps["href"];
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [folded, setFolded] = useState(
    () => readStored("sessionStorage", FOLDED) === "1",
  );
  const fold = (to: boolean) => {
    setFolded(to);
    store("sessionStorage", FOLDED, to ? "1" : null);
  };
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      const step = STEPS[event.key];
      const target = event.target as HTMLElement;
      if (
        !step ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      const link = bar.current?.querySelector<HTMLElement>(
        `[data-step="${step}"]`,
      );
      if (!link) return;
      event.preventDefault();
      link.click();
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, []);
  const control = "flex items-center rounded p-1 hover:opacity-70";
  return createPortal(
    <div
      ref={bar}
      data-react-aria-top-layer=""
      className="fixed bottom-2 left-2 z-[2147483647] max-w-[calc(100vw-1rem)] rounded-lg bg-fg/90 p-1 text-xs text-bg shadow-lg"
    >
      {/* folded, the rows stay in the page, hidden, for the keys to press */}
      <div hidden={folded} className="flex items-stretch gap-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Row what="layout" keys="↑ ↓" choices={layouts} shown={layout} />
          <Row what="case" keys="← →" choices={cases} shown={shown} />
        </div>
        <div className="flex flex-col justify-between border-s border-bg/30 ps-1">
          <Link
            href={index}
            aria-label="Every layout and case"
            className={control}
          >
            <LayoutGrid size={16} aria-hidden />
          </Link>
          <Button
            onPress={() => fold(true)}
            aria-label="Fold the bar"
            className={control}
          >
            <Minus size={16} aria-hidden />
          </Button>
        </div>
      </div>
      {folded && (
        <Button
          onPress={() => fold(false)}
          aria-label="Unfold the bar"
          className="rounded px-1.5 py-0.5 font-semibold hover:opacity-70"
        >
          {layout} · {shown}
        </Button>
      )}
    </div>,
    document.body,
  );
}

function Row({
  what,
  keys,
  choices,
  shown,
}: {
  what: "layout" | "case";
  keys: string;
  choices: Choice[];
  shown: string;
}) {
  const at = Math.max(
    choices.findIndex(({ key }) => key === shown),
    0,
  );
  const step = (by: number) =>
    choices[(at + by + choices.length) % choices.length];
  const choice = choices[at];
  if (!choice) return null;
  const many = choices.length > 1;
  const link = "rounded p-1 hover:opacity-70";
  // a key that's its place says it once: "2/14", not "2 (2/14)"
  const place =
    choice.key === String(at + 1)
      ? `${choice.key}/${choices.length}`
      : `${choice.key} ${at + 1}/${choices.length}`;
  return (
    <div className="flex items-center gap-1">
      {many && (
        <Link
          href={step(-1)?.href}
          data-step={`${what}-back`}
          aria-label={`Previous ${what}`}
          aria-keyshortcuts={what === "layout" ? "ArrowUp" : "ArrowLeft"}
          className={link}
        >
          <ChevronLeft size={16} aria-hidden />
        </Link>
      )}
      <span className="truncate" title={`${choice.name} (${keys})`}>
        <span className="opacity-70">
          {what === "layout" ? "Layout" : "Case"}
        </span>{" "}
        <span className="font-semibold">{place}</span> {choice.name}
      </span>
      {many && (
        <Link
          href={step(1)?.href}
          data-step={`${what}-on`}
          aria-label={`Next ${what}`}
          aria-keyshortcuts={what === "layout" ? "ArrowDown" : "ArrowRight"}
          className={`${link} ms-auto`}
        >
          <ChevronRight size={16} aria-hidden />
        </Link>
      )}
    </div>
  );
}
