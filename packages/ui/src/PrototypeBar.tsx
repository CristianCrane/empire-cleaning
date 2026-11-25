import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, type LinkProps } from "react-aria-components";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";

// one of a prototype's layouts or cases, and the link that draws it
type Choice = { key: string; name: string; href: LinkProps["href"] };

// the arrow keys, and which link each presses
const STEPS: Record<string, string> = {
  ArrowUp: "layout-back",
  ArrowDown: "layout-on",
  ArrowLeft: "case-back",
  ArrowRight: "case-on",
};

// The bar a prototype is looked at with (docs/ux.md, Changing a screen): the
// layout and the case on show, and links to the one before and after each,
// pressed by ↑/↓ (layouts) and ←/→ (cases) unless a field has the keys. The
// web app's prototype shell and the landing site's prototype page each place
// it once, in the bottom left corner, above all a case draws (a dialog's
// backdrop, a bank's pop-up), and in React Aria's top layer, as the toasts
// are, which an open dialog leaves pressable, so a press reaches it as the
// keys do. It's drawn in the browser alone (the landing site's client:only). Its links go through the web app's
// router there, and are plain links on the landing site. Drawn only in
// development: an e2e run, and so `pnpm pr:shots --prototype`, serves a
// production build, so the shots have the screen alone
export function PrototypeBar({
  layouts,
  cases,
  layout,
  case: shown,
}: {
  layouts: Choice[];
  cases: Choice[];
  layout: string;
  case: string;
}) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      const step = STEPS[event.key];
      const target = event.target as HTMLElement;
      if (!step || target.closest("input, textarea, select, [contenteditable]"))
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
  if (!import.meta.env.DEV) return null;
  return createPortal(
    <div
      ref={bar}
      data-react-aria-top-layer=""
      className="fixed bottom-2 left-2 z-[2147483647] flex max-w-[calc(100vw-1rem)] flex-col gap-0.5 rounded-lg bg-fg/90 p-1 text-xs text-bg shadow-lg"
    >
      <Row
        what="layout"
        choices={layouts}
        shown={layout}
        icons={[ChevronUp, ChevronDown]}
      />
      <Row
        what="case"
        choices={cases}
        shown={shown}
        icons={[ChevronLeft, ChevronRight]}
      />
    </div>,
    document.body,
  );
}

function Row({
  what,
  choices,
  shown,
  icons: [Back, On],
}: {
  what: "layout" | "case";
  choices: Choice[];
  shown: string;
  icons: [typeof ChevronUp, typeof ChevronUp];
}) {
  const at = Math.max(
    choices.findIndex(({ key }) => key === shown),
    0,
  );
  const step = (by: number) =>
    choices[(at + by + choices.length) % choices.length];
  const choice = choices[at];
  if (!choice) return null;
  const link = "rounded p-1 hover:opacity-70";
  return (
    <div className="flex items-center gap-1">
      <Link
        href={step(-1)?.href}
        data-step={`${what}-back`}
        aria-label={`Previous ${what}`}
        className={link}
      >
        <Back size={16} aria-hidden />
      </Link>
      <span className="truncate" title={choice.name}>
        <span className="font-semibold">
          {choice.key} ({at + 1}/{choices.length})
        </span>{" "}
        {choice.name}
      </span>
      <Link
        href={step(1)?.href}
        data-step={`${what}-on`}
        aria-label={`Next ${what}`}
        className={`${link} ms-auto`}
      >
        <On size={16} aria-hidden />
      </Link>
    </div>
  );
}
