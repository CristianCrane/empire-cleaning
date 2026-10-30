import type { ReactNode } from "react";

// What a Card says and the Button(s) it leads to, on one row: the text on
// the left, the Buttons right and centred on it. At phone width the Buttons
// wrap under the text, still on the right. Put the main action last.
export function ActionRow({
  children,
  actions,
}: {
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="flex min-w-0 grow basis-64 flex-col gap-2 text-fg-muted [&_strong]:text-fg">
        {children}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
