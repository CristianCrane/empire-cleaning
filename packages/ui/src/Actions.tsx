import type { ReactNode } from "react";

// the row of buttons at the foot of a form or dialog. Put the main action
// last: on a phone the buttons stack full width with it at the bottom,
// nearest the thumb; on larger screens they sit right-aligned with it on the
// right. In a Dialog they stay pinned at its foot as its body scrolls
// (Dialog.tsx places the row it marks: data-actions)
export function Actions({ children }: { children: ReactNode }) {
  return (
    <div
      data-actions
      className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto"
    >
      {children}
    </div>
  );
}
