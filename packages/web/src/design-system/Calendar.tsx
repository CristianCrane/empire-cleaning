import {
  Calendar as AriaCalendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
  type CalendarProps,
  type DateValue,
} from "react-aria-components";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button.tsx";
import { focusRing } from "./utils.ts";

export function Calendar<T extends DateValue>(props: CalendarProps<T>) {
  return (
    <AriaCalendar {...props} className="w-fit text-fg">
      <div className="flex items-center gap-1 pb-3">
        <Button slot="previous" variant="quiet" size="icon">
          <ChevronLeft aria-hidden size={20} />
        </Button>
        <Heading className="flex-1 text-center font-display text-lg font-semibold tracking-wide uppercase" />
        <Button slot="next" variant="quiet" size="icon">
          <ChevronRight aria-hidden size={20} />
        </Button>
      </div>
      <CalendarGrid className="border-separate border-spacing-0.5">
        <CalendarGridHeader>
          {(day) => (
            <CalendarHeaderCell className="pb-1 text-xs font-semibold text-fg-muted">
              {day}
            </CalendarHeaderCell>
          )}
        </CalendarGridHeader>
        <CalendarGridBody>
          {(date) => (
            <CalendarCell
              date={date}
              className={(renderProps) =>
                `${focusRing(renderProps)} flex size-10 cursor-default items-center justify-center rounded-full text-sm tabular-nums outside-month:invisible hover:bg-surface-sunken pressed:bg-surface-sunken selected:bg-primary selected:font-semibold selected:text-primary-fg disabled:text-fg-muted disabled:opacity-50 unavailable:text-fg-muted unavailable:line-through`
              }
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </AriaCalendar>
  );
}
