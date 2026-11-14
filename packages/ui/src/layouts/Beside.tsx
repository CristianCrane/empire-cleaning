import type { ReactNode } from "react";

// A page's main column and what goes beside it (a Record's History, what a
// Form page's fields come to): a 22rem column on the right from `xl`, so
// every type's right column lines up, and after the main one below that.
// `sticky` keeps the side in view as the main column scrolls past it.
// `leads` puts the side first below `xl` (a price the form is written to
// reach): first in the page too, so a phone reads and tabs through it in
// the order it's seen, placed in the right column from `xl`
export function Beside({
  side,
  sticky = false,
  leads = false,
  children,
}: {
  side?: ReactNode;
  sticky?: boolean;
  leads?: boolean;
  children: ReactNode;
}) {
  const placed = [
    sticky && "xl:sticky xl:top-6",
    leads && "xl:col-start-2 xl:row-start-1",
  ]
    .filter(Boolean)
    .join(" ");
  const shown = side && (placed ? <div className={placed}>{side}</div> : side);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      {leads && shown}
      {leads ? (
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">{children}</div>
      ) : (
        children
      )}
      {!leads && shown}
    </div>
  );
}
