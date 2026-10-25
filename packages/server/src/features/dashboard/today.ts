import type { Today } from "@empire-cleaning/models";
import { clock, dayOf } from "../../services/clock/index.ts";
import { scheduleFor } from "../jobs/schedule.ts";

// today's Schedule in New York, with how far each Job is assigned and how it
// turned out
export const today = async (): Promise<Today> => {
  const date = dayOf(clock.now());
  const [day] = await scheduleFor(date, date);
  return {
    ...day!,
    jobs: day!.jobs.map((job) => ({
      ...job,
      // No Access (#11) sets it too
      outcome: job.status === "completed" ? ("completed" as const) : null,
    })),
  };
};
