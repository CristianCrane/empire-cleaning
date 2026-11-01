import { useState } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import type { LocalDateTime, ScheduledJob } from "@empire-cleaning/models";
import { Dialog, Heading, StatusBadge } from "@empire-cleaning/ui";
import { ConfirmMove } from "./JobMove.tsx";
import { RangeBar } from "../CalendarGrid.tsx";
import { ScheduleCalendar } from "./ScheduleCalendar.tsx";
import { rangeShowing, scheduleRange, type Span } from "../schedule-range.ts";

/**
 * The Schedule as a calendar: days as columns over a time axis, each Job a
 * block placed at its start and sized by its time on site. A week at a time,
 * or a day or three on a phone. Clicking a Job opens it; on a desktop,
 * Office Staff drag one to move it, confirming first.
 */
export function ScheduleScreen() {
  const days = useLoaderData({ from: "/office/schedule" });
  const { from, to } = scheduleRange(useSearch({ from: "/office/schedule" }));
  const navigate = useNavigate({ from: "/office/schedule" });
  const [moving, setMoving] = useState<{
    job: ScheduledJob;
    to: LocalDateTime;
  }>();

  const show = (span: Span, day: string) =>
    navigate({ search: rangeShowing(span, day) });

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1} inBar>
        Schedule
      </Heading>
      <RangeBar from={from} to={to} onShow={show} />
      <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        <StatusBadge tone="warning">Unassigned</StatusBadge>
        <StatusBadge tone="info">Assigned</StatusBadge>
        <StatusBadge tone="success">Completed</StatusBadge>
        <StatusBadge tone="danger">No Access</StatusBadge>
        <span className="hidden md:inline">
          Drag a Job to move it, or open it to move it to any time.
        </span>
        <span className="md:hidden">Open a Job to move it.</span>
      </div>
      <ScheduleCalendar
        days={days}
        onDrop={(job, to) => setMoving({ job, to })}
      />
      <Dialog
        title="Move this Job?"
        isOpen={moving !== undefined}
        onOpenChange={(isOpen) => !isOpen && setMoving(undefined)}
      >
        {({ close }) =>
          moving && (
            <ConfirmMove job={moving.job} to={moving.to} close={close} />
          )
        }
      </Dialog>
    </div>
  );
}
