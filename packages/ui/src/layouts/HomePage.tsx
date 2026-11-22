import { useId, type ReactNode } from "react";
import { firstNameOf } from "@empire-cleaning/models";
import type { LinkProps } from "react-aria-components";
import type { LucideIcon } from "lucide-react";
import { Card } from "../Card.tsx";
import { CountTile } from "../CountTile.tsx";
import { Heading } from "../Heading.tsx";
import { useUiWords } from "../language.ts";
import { List } from "../List.tsx";
import { ShortcutTile } from "../ShortcutTile.tsx";
import { listRowItem, type ListRow } from "./ListPage.tsx";
import type { PageActions } from "./PageActions.tsx";
import { PageHeader } from "./PageHeader.tsx";

// The Home type's layout (docs/ux.md, Screen types, Home; #435): where an
// area starts. The person greeted, one card answering what's next or
// what's owed with the page's one primary, then two to four tiles; no row
// shows until a tile is pressed

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
const tileGrid = (count: number) =>
  `grid grid-cols-2 gap-3 ${wideColumns[Math.min(Math.max(count, 1), 4) - 1]} [&>li:last-child:nth-child(odd)]:col-span-2 sm:[&>li:last-child:nth-child(odd)]:col-span-1`;

// A Home's one answer, read left to right: its tile (a DateTile for when,
// an IconTile for what), the kind of answer it is (muted, above), the
// answer large, a line or two, and its Buttons, the page's one primary
// last. With a label it's a region by that name. All clear, it's a green
// IconTile and the headline alone
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
  const labelId = useId();
  return (
    <Card labelledBy={label ? labelId : undefined}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {tile}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {label && (
            <Heading level={2} size={4} id={labelId} className="text-fg-muted">
              {label}
            </Heading>
          )}
          <p className="text-2xl font-semibold text-fg sm:text-3xl">
            {headline}
          </p>
          {lines.map((line, i) => (
            <p key={i} className="text-fg-muted [overflow-wrap:anywhere]">
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

// One of a Home's tiles. Where its rows have a List page of their own, it
// links there, the count in its hint; where they don't, it shows how many
// and opens them in place, under the tiles: its `rows`, or for rows of a
// shape of their own (Payments' Statement) its `panel`, then `more` (the
// way to where all of them are). A tile with none is greyed out
export type HomeTile = {
  id: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
} & (
  | {
      count: number;
      // shown in the count's place, where the kind is judged by something
      // else (CountTile)
      value?: string;
      rows?: ListRow[];
      panel?: ReactNode;
      more?: ReactNode;
    }
  | { href: LinkProps["href"]; externalHref?: undefined }
  | { externalHref: string; href?: undefined }
);

export function HomePage({
  greet,
  title,
  actions,
  answer,
  notices,
  tilesLabel,
  tiles,
  open,
  onOpen,
}: {
  // the person's name: the page greets them by their first (an area's
  // first page)
  greet?: string;
  // or the page's own name, which a phone's top bar shows (Payments)
  title?: string;
  actions?: PageActions;
  // an AnswerCard
  answer: ReactNode;
  // news under the card, never an action (a bank payment on its way)
  notices?: ReactNode;
  tilesLabel: string;
  tiles: HomeTile[];
  // the tile opened in place, which the screen keeps in its URL so Back
  // comes back to it. One with none in it shows closed (counted again
  // while open, it may have cleared)
  open?: string | null;
  onOpen?: (id: string | null) => void;
}) {
  const words = useUiWords();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={greet ? words.hi(firstNameOf(greet)) : (title ?? "")}
        inBar={!greet}
        actions={actions}
      />
      {answer}
      {notices}
      <HomeTiles label={tilesLabel} tiles={tiles} open={open} onOpen={onOpen} />
    </div>
  );
}

// A Home's tiles in a row, two a row on a phone, and under them the rows
// of the one opened in place. One with none in it shows closed (counted
// again while open, it may have cleared)
export function HomeTiles({
  label,
  tiles,
  open,
  onOpen,
}: {
  label: string;
  tiles: HomeTile[];
  open?: string | null;
  onOpen?: (id: string | null) => void;
}) {
  const opened = tiles.find(
    (t) => t.id === open && "count" in t && t.count > 0,
  );
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={label} className={tileGrid(tiles.length)}>
        {tiles.map((tile) => (
          <li key={tile.id}>
            {"count" in tile ? (
              <CountTile
                icon={tile.icon}
                label={tile.label}
                count={tile.count}
                value={tile.value}
                hint={tile.hint}
                isSelected={tile === opened}
                onChange={(on) => onOpen?.(on ? tile.id : null)}
              />
            ) : (
              <ShortcutTile
                icon={tile.icon}
                label={tile.label}
                hint={tile.hint ?? ""}
                href={tile.href}
                externalHref={tile.externalHref}
              />
            )}
          </li>
        ))}
      </ul>
      {opened && "count" in opened && (
        <div className="flex flex-col gap-3">
          {opened.rows && (
            <List aria-label={opened.label}>
              {opened.rows.map((row) => listRowItem(row))}
            </List>
          )}
          {opened.panel}
          {opened.more}
        </div>
      )}
    </div>
  );
}
