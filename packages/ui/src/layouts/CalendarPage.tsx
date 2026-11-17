import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader.tsx";

// The Calendar type's layout (docs/ux.md, Screen types, Calendar; #437):
// the Schedule, one of a kind. The page header every type shares, its
// title in the bar on a phone, then the calendar's own parts (what range
// it shows, its key, the days), which are the screen's
export function CalendarPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} inBar />
      {children}
    </div>
  );
}
