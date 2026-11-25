import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Link, type LinkProps } from "react-aria-components";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  LayoutGrid,
  Minus,
} from "lucide-react";
import { readStored, store } from "./stored.ts";

// one of a prototype's layouts or cases, and the link that draws it
type Choice = { key: string; name: string; href: LinkProps["href"] };

// each row's step links, and the arrow keys that press them: each link
// carries its key (data-key: React Aria's Link drops aria-keyshortcuts),
// which the keys find it by, and is drawn as that key, so the marks say
// which key steps what
const MARKS = {
  layout: { back: ArrowUp, on: ArrowDown, keys: ["ArrowUp", "ArrowDown"] },
  case: { back: ArrowLeft, on: ArrowRight, keys: ["ArrowLeft", "ArrowRight"] },
};

// whether the bar is folded to its tab, kept across the pages a person
// steps through (the landing site's are each a page load); a browser that
// keeps nothing starts it open
const FOLDED = "prototype-bar-folded";

// The bar a prototype is looked at with (docs/ux.md, Changing a screen): the
// layout and the case on show, links to the one before and after each,
// pressed by ↑/↓ (layouts) and ←/→ (cases) unless a field has the keys or a
// modifier is held (Alt+← is the browser's Back), and a link to the list of
// them all. The web app's prototype shell and the landing site's prototype
// page each place it once, in the bottom left corner, one width whatever the
// names, so its links stay put from case to case, above all a case draws
// (a dialog's backdrop, a bank's pop-up), and in React Aria's top layer, as
// the toasts are, which an open dialog leaves pressable, so a press reaches
// it as the keys do. It covers what's under it, so it folds to a tab
// naming the layout and case as the list's cells do (A over 2), halfway down
// the right edge, clear of a frame's bars and corners, and as narrow as a
// phone's 16px side margin, so it sits beside the screen's rows, not on them;
// the keys still step. It's drawn in the
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
      const target = event.target as HTMLElement;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      const link = bar.current?.querySelector<HTMLElement>(
        `[data-key="${CSS.escape(event.key)}"]`,
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
      className={`fixed z-[2147483647] bg-fg text-xs text-bg shadow-lg ${
        folded
          ? "end-0 top-1/2 -translate-y-1/2 rounded-s-md"
          : "bottom-2 start-2 w-[min(24rem,calc(100vw-1rem))] rounded-lg p-1"
      }`}
    >
      {/* folded, the rows stay in the page, hidden, for the keys to press */}
      <div hidden={folded} className="flex items-stretch gap-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Row what="layout" choices={layouts} shown={layout} />
          <Row what="case" choices={cases} shown={shown} />
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
          className="flex h-11 w-4 flex-col items-center justify-center text-[11px] leading-none font-semibold hover:opacity-70"
        >
          <span>{layout}</span>
          <span>{shown}</span>
        </Button>
      )}
    </div>,
    document.body,
  );
}

function Row({
  what,
  choices,
  shown,
}: {
  what: "layout" | "case";
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
  const { back: Back, on: On, keys } = MARKS[what];
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
          aria-label={`Previous ${what}`}
          data-key={keys[0]}
          className={link}
        >
          <Back size={16} aria-hidden />
        </Link>
      )}
      <span className="truncate" title={choice.name}>
        <span className="opacity-70">
          {what === "layout" ? "Layout" : "Case"}
        </span>{" "}
        <span className="font-semibold">{place}</span> {choice.name}
      </span>
      {many && (
        <Link
          href={step(1)?.href}
          aria-label={`Next ${what}`}
          data-key={keys[1]}
          className={`${link} ms-auto`}
        >
          <On size={16} aria-hidden />
        </Link>
      )}
    </div>
  );
}
