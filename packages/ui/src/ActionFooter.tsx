import { useLayoutEffect, useRef, type ReactNode } from "react";

// A page's actions, fixed at the foot of the screen so they stay in reach
// while the page scrolls: above the phone's tab bar, beside the sidebar on
// a wider screen. The app's one bar at a page's foot (docs/ux.md, Buttons
// and actions): a Cleaner's Job on site, a Quote Draft's prices and Send.
// What it sums up goes first (`summary`, then `status`, a line that's
// read out as it changes: a save's state), the main action last. While shown, its
// height (taller when its actions wrap) is `--action-footer-height` on the
// page: the room it leaves below the page, so nothing hides under it, and
// for what floats above it (the test site's feedback button).
// a page's bar as its layout places it (RecordPage's, FormPage's)
export type Footer = {
  label: string;
  summary?: ReactNode;
  status?: ReactNode;
  // its actions, the main one last
  children: ReactNode;
};

export function ActionFooter({
  "aria-label": label,
  summary,
  status,
  children,
}: {
  "aria-label": string;
  summary?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}) {
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
        className="h-(--action-footer-height,4rem) print:hidden"
      />
      <div
        ref={footer}
        role="group"
        aria-label={label}
        className="fixed inset-x-0 bottom-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface px-4 py-3 shadow-raised md:bottom-0 md:left-64 md:px-8 print:hidden"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
          {(summary || status) && (
            <div className="flex min-w-0 flex-1 flex-col">
              {summary && (
                <span className="font-semibold tabular-nums">{summary}</span>
              )}
              <span role="status" className="text-sm text-fg-muted">
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
