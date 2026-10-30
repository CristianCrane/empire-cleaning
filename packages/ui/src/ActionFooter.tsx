import type { ReactNode } from "react";

// A page's actions, fixed at the foot of the screen so they stay in reach
// while the page scrolls: above the phone's tab bar, beside the sidebar on
// a wider screen. For a page used on the move, like a Cleaner's Job on
// site. Put the main action last; it leaves room below the page so nothing
// hides under it.
export function ActionFooter({
  "aria-label": label,
  children,
}: {
  "aria-label": string;
  children: ReactNode;
}) {
  return (
    <>
      <div aria-hidden className="h-16 print:hidden" />
      <div
        role="group"
        aria-label={label}
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface px-4 py-3 shadow-raised md:bottom-0 md:left-64 md:px-8 print:hidden"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
          {children}
        </div>
      </div>
    </>
  );
}
