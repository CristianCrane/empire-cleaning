import type { ReactNode } from "react";

// the row of buttons at the foot of a form or dialog: stacked full width on a
// phone with the first (main) action nearest the thumb, right-aligned on
// larger screens with the main action last
export function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
      {children}
    </div>
  );
}
