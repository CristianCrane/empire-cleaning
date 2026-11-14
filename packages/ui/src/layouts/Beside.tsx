import type { ReactNode } from "react";

// A page's main column and what goes beside it (a Record's History, what a
// Form page's fields come to): a 22rem column on the right from `xl`, so
// every type's right column lines up, and after the main one below that.
// `sticky` keeps the side in view as the main column scrolls past it
export function Beside({
  side,
  sticky = false,
  children,
}: {
  side?: ReactNode;
  sticky?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      {children}
      {side &&
        (sticky ? <div className="xl:sticky xl:top-6">{side}</div> : side)}
    </div>
  );
}
