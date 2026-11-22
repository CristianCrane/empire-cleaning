import { useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import type { LocalDateTime } from "@empire-cleaning/models";
import { CalendarPage, Dialog } from "@empire-cleaning/ui";
import { ConfirmMove } from "./JobMove.tsx";
import { ConfirmVisitMove } from "./SiteVisitParts.tsx";
import { RangeBar } from "../CalendarGrid.tsx";
import {
  BlockKey,
  ScheduleCalendar,
  VisitKey,
  type Moving,
} from "./ScheduleCalendar.tsx";
import {
  chooseSpan,
  rangeShowing,
  scheduleRange,
  type Span,
} from "../schedule-range.ts";

/**
 * The Schedule as a calendar: days as columns over a time axis, each Job a
 * block placed at its start and sized by its time on site. A day, three days
 * or a week at a time: the span chosen last, kept for the next visit (a day
 * at first on a phone, three days on anything wider). Clicking a Job or Site Visit opens it; on a desktop,
 * Office Staff drag one to move it, confirming first.
 */
export function ScheduleScreen() {
  const days = useLoaderData({ from: "/office/schedule" });
  const { from, to } = scheduleRange(useSearch({ from: "/office/schedule" }));
  const navigate = useNavigate({ from: "/office/schedule" });
  const [moving, setMoving] = useState<Moving & { to: LocalDateTime }>();

  const show = (span: Span, day: string) => {
    chooseSpan(span);
    return navigate({ search: rangeShowing(span, day) });
  };

  return (
    <CalendarPage title="Schedule">
      <RangeBar from={from} to={to} onShow={show} />
      <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        <BlockKey job={{ status: "booked", assignment: "unassigned" }} />
        <BlockKey job={{ status: "booked", assignment: "assigned" }} />
        <BlockKey job={{ status: "completed", assignment: "assigned" }} />
        <BlockKey job={{ status: "no_access", assignment: "assigned" }} />
        <VisitKey />
        <span className="hidden md:inline">
          Drag a job or site visit to move it, or open it to pick any time.
        </span>
        <span className="md:hidden">Open a job or site visit to move it.</span>
      </div>
      <ScheduleCalendar
        days={days}
        onDrop={(what, to) => setMoving({ ...what, to })}
      />
      <Dialog
        title={
          moving?.kind === "visit" ? "Move this site visit?" : "Move this job?"
        }
        isOpen={moving !== undefined}
        onOpenChange={(isOpen) => !isOpen && setMoving(undefined)}
      >
        {({ close }) =>
          moving &&
          (moving.kind === "job" ? (
            <ConfirmMove job={moving.job} to={moving.to} close={close} />
          ) : (
            <ConfirmVisitMove
              visit={moving.visit}
              to={moving.to}
              close={close}
            />
          ))
        }
      </Dialog>
    </CalendarPage>
  );
}
