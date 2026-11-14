import type { ReactNode } from "react";
import { Card } from "../Card.tsx";
import { Heading } from "../Heading.tsx";

// The Home type's layout (docs/ux.md, Screen types, Home; #435): where an
// area starts

// on a wider screen, a column a tile, up to four, so fewer fill the row
const wideColumns = [
  "sm:grid-cols-1",
  "sm:grid-cols-2",
  "sm:grid-cols-3",
  "sm:grid-cols-4",
];

// a row of tiles: two a row on a phone, an odd one out spanning the row;
// up to four on a wider screen, filling it, with no gap at the end. The
// tiles are the grid's `li`s
export const tileGrid = (count: number) =>
  `grid grid-cols-2 gap-3 ${wideColumns[Math.min(Math.max(count, 1), 4) - 1]} [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1`;

// A Home's one answer, read left to right: its tile (a DateTile for when,
// an IconTile for what), the kind of answer it is (muted, above), the
// answer large, a line or two, and its Buttons, the page's one primary
// last
export function AnswerCard({
  tile,
  label,
  headline,
  lines = [],
  actions,
}: {
  tile: ReactNode;
  label?: string;
  headline: ReactNode;
  lines?: ReactNode[];
  actions?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {tile}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {label && (
            <Heading level={2} size={4} className="text-fg-muted">
              {label}
            </Heading>
          )}
          <p className="text-2xl font-semibold text-fg sm:text-3xl">
            {headline}
          </p>
          {lines.map((line, i) => (
            <p key={i} className="text-fg-muted">
              {line}
            </p>
          ))}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap gap-2 self-start sm:flex-col sm:items-stretch sm:self-center">
            {actions}
          </div>
        )}
      </div>
    </Card>
  );
}
