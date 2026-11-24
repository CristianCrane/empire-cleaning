import { useLayoutEffect, useRef, type ReactNode } from "react";

// A page's actions, fixed at the foot of the screen so they stay in reach
// while the page scrolls: above the phone's tab bar, beside the rail or the
// sidebar on a wider screen (`--spacing-side`). The app's one bar at a
// page's foot (docs/ux.md, Buttons and actions), on a phone (`phone`: a
// wider screen keeps them in the header): a Record's next step, and a Quote
// Draft's or New quote's price and button.
// What it sums up goes first (`summary`, then `status`, a line that's
// read out as it changes: a save's state, and what the button waits on),
// the main action last. A Record's next step greyed, `why` says why in
// short on a line above it all, as a greyed menu item's line does, as the
// page's alert saying it may have scrolled away (#534). While shown, its
// height (taller when its actions wrap) is `--action-footer-height` on the
// page: the room it leaves below the page, so nothing hides under it, and
// for what floats above it (the test site's feedback button).
export function ActionFooter({
  "aria-label": label,
  summary,
  status,
  why,
  phone = false,
  children,
}: {
  "aria-label": string;
  summary?: ReactNode;
  status?: ReactNode;
  why?: string;
  // drawn on a phone alone
  phone?: boolean;
  children: ReactNode;
}) {
  const only = phone ? "md:hidden" : "";
  const footer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = footer.current;
    if (!element) return;
    const { style } = document.documentElement;
    const observer = new ResizeObserver(() =>
      style.setProperty("--action-footer-height", `${element.offsetHeight}px`),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      style.removeProperty("--action-footer-height");
    };
  }, []);
  return (
    <>
      <div
        aria-hidden
        className={`h-(--action-footer-height,4rem) print:hidden ${only}`}
      />
      <div
        ref={footer}
        role="group"
        aria-label={label}
        className={`fixed inset-x-0 bottom-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface py-3 shadow-raised left-side md:bottom-0 print:hidden ${only}`}
      >
        <div className="page-column flex flex-wrap items-center justify-end gap-2">
          {why && <p className="w-full text-sm text-fg-muted">{why}</p>}
          {(summary || status) && (
            <div className="flex min-w-0 flex-1 flex-col">
              {summary && (
                <span className="font-semibold tabular-nums">{summary}</span>
              )}
              <span
                role="status"
                className="text-sm text-balance text-fg-muted"
              >
                {status}
              </span>
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
