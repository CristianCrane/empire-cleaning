import type { HTMLAttributes, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LocalDateTime } from "@empire-cleaning/models";
import { Button, Select, SelectItem } from "@empire-cleaning/ui";
import { addDays, formatClock, formatDay, today } from "./format.ts";
import { hoursOf, timeAt } from "./schedule-layout.ts";
import { daysIn, SPANS, type Span } from "./schedule-range.ts";

// the frame every calendar here shares, for the Office's Schedule and a
// Client's own times alike: days as columns over a time axis

// how tall an hour is on the time axis
export const HOUR_PX = 48;

const spanLabel: Record<Span, string> = { 1: "Day", 3: "3 days", 7: "Week" };
const stepLabel: Record<Span, string> = { 1: "day", 3: "3 days", 7: "week" };

/**
 * Moving through a calendar: back and forward a step, back to today, and
 * how many days to show at once.
 */
export function RangeBar({
  from,
  to,
  onShow,
}: {
  from: string;
  to: string;
  onShow: (span: Span, day: string) => void;
}) {
  const span = daysIn(from, to) as Span;
  // the day to keep in view when the span changes: today, if it's shown
  const anchor = today() >= from && today() <= to ? today() : from;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="quiet"
          size="icon"
          aria-label={`Previous ${stepLabel[span]}`}
          onPress={() => onShow(span, addDays(from, -span))}
        >
          <ChevronLeft aria-hidden size={20} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => onShow(span, today())}
        >
          {span === 7 ? "This week" : "Today"}
        </Button>
        <Button
          variant="quiet"
          size="icon"
          aria-label={`Next ${stepLabel[span]}`}
          onPress={() => onShow(span, addDays(from, span))}
        >
          <ChevronRight aria-hidden size={20} />
        </Button>
        <p className="font-semibold" aria-live="polite">
          {from === to
            ? formatDay(from)
            : `${formatDay(from)} – ${formatDay(to)}`}
        </p>
      </div>
      <Select
        label="Show"
        className="w-32"
        selectedKey={span}
        onSelectionChange={(key) => onShow(Number(key) as Span, anchor)}
      >
        {SPANS.map((s) => (
          <SelectItem key={s} id={s} textValue={spanLabel[s]}>
            {spanLabel[s]}
          </SelectItem>
        ))}
      </Select>
    </div>
  );
}

// a day's column: its header, and what's placed on the time axis under it
export type GridColumn = {
  date: string;
  header: ReactNode;
  body: ReactNode;
  // what the body is called to a screen reader, e.g. "Jobs on Tue, Mar 2"
  bodyLabel: string;
  className?: string;
  bodyProps?: HTMLAttributes<HTMLDivElement>;
};

/**
 * Days as columns over a time axis from `axis.start` to `axis.end` (whole
 * hours). Each column is a region named for its day; its body is as tall as
 * the axis, for its contents to be placed on absolutely.
 */
export function TimeGrid({
  columns,
  axis,
}: {
  columns: GridColumn[];
  axis: { start: number; end: number };
}) {
  const hours = Array.from(
    { length: axis.end - axis.start },
    (_, i) => axis.start + i,
  );
  const wide = columns.length === 7;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <div
        className="grid grid-rows-[auto_1fr]"
        style={{
          gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(${wide ? "6.5rem" : "0"}, 1fr))`,
        }}
      >
        <div className="row-span-2 grid grid-rows-subgrid">
          <div className="border-b border-border" />
          {/* each hour's label level with its line, the first just below
              the header */}
          <div aria-hidden className="relative">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 pe-2 text-end text-xs leading-none text-fg-muted"
                style={{ top: i === 0 ? 2 : i * HOUR_PX - 6 }}
              >
                {formatClock(timeAt(h))}
              </div>
            ))}
          </div>
        </div>
        {columns.map((column) => (
          <section
            key={column.date}
            aria-label={formatDay(column.date)}
            className={`row-span-2 grid min-w-0 grid-rows-subgrid border-s border-border transition-opacity ${column.className ?? ""}`}
          >
            {column.header}
            <div
              {...column.bodyProps}
              role="group"
              aria-label={column.bodyLabel}
              className={`relative ${column.bodyProps?.className ?? ""}`}
              style={{ height: hours.length * HOUR_PX }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="border-t border-border first:border-t-0"
                  style={{ height: HOUR_PX }}
                />
              ))}
              {column.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// a time that can be picked, placed on a column's body. Out of the tab
// order: wherever there's a calendar to pick from, the keyboard's way is
// the fields beside it
export function PickSlot({
  at,
  axisStart,
  hours,
  isSelected,
  className = "",
  children,
  onPick,
}: {
  at: LocalDateTime;
  axisStart: number;
  // how tall, in hours
  hours: number;
  isSelected?: boolean;
  className?: string;
  children: ReactNode;
  onPick: (at: LocalDateTime) => void;
}) {
  return (
    <Button
      variant={isSelected ? "primary" : "quiet"}
      excludeFromTabOrder
      aria-label={`${formatDay(at.date)}, ${formatClock(at.time)}`}
      className={`group absolute inset-x-0.5 min-h-0 items-start justify-start rounded-md px-1.5 py-0.5 text-xs font-normal ${className}`}
      style={{
        top: (hoursOf(at.time) - axisStart) * HOUR_PX + 1,
        height: hours * HOUR_PX - 2,
      }}
      onPress={() => onPick(at)}
    >
      {children}
    </Button>
  );
}

// what a calendar to pick a clean's time from is given: what's chosen so
// far, how long the clean is on site, where it's booked now if it is, and
// for a Reschedule Request, the only days and start times on offer
export type TimePickerProps = {
  date?: string;
  time?: string;
  hoursOnSite: number;
  current?: LocalDateTime;
  limits?: { days: string[]; times: string[] };
  onPick: (at: LocalDateTime) => void;
};
