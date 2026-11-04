import type {
  ScheduleDay,
  ScheduledJob,
  ScheduledSiteVisit,
} from "@empire-cleaning/models";

// Days of the Schedule as plain data, for testing the rules over them with
// nothing saved. Monday 5 January 2026, 4am New York; the Job is on Thursday
// the 8th, 9am to noon on site (6 Labour Hours, a crew of two), with Ana and
// Bea available that day.
export const NOW = new Date("2026-01-05T09:00:00Z");
export const THURSDAY_9AM = "2026-01-08T14:00:00.000Z";
export const HOUR = 3_600_000;

// an instant some hours after the Job starts (before it, if negative)
export const afterNine = (hours: number) =>
  new Date(Date.parse(THURSDAY_9AM) + hours * HOUR);

export const scheduled = (over: Partial<ScheduledJob> = {}): ScheduledJob => ({
  id: "job",
  startsAt: THURSDAY_9AM,
  serviceName: "Standard Clean",
  status: "booked",
  labourHours: 6,
  crewSize: 2,
  hoursOnSite: 3,
  client: { id: "client", name: "Casey Lee", businessName: null },
  property: {
    id: "home",
    street: "41 Austin St",
    unit: null,
    postcode: "11375",
  },
  assignment: "unassigned",
  crew: [],
  movable: true,
  ...over,
});

// another Job that day, `hours` after this one starts, with Ana on it
export const otherJob = (hours: number, over: Partial<ScheduledJob> = {}) =>
  scheduled({
    id: "other",
    startsAt: afterNine(hours).toISOString(),
    crew: [{ id: "ana", name: "Ana Ruiz" }],
    ...over,
  });

export const siteVisit = (
  hours: number,
  status: ScheduledSiteVisit["status"],
): ScheduledSiteVisit => ({
  id: "visit",
  quoteId: null,
  status,
  startsAt: afterNine(hours).toISOString(),
  minutes: 30,
  visitor: { id: "ana", name: "Ana Ruiz" },
  client: { id: "client", name: "Casey Lee", businessName: null },
  property: {
    id: "home",
    street: "41 Austin St",
    unit: null,
    postcode: "11375",
    kind: "residential",
  },
  bookedAt: NOW.toISOString(),
  doneAt: null,
  cancelledAt: null,
  takesRoom: true,
});

// Thursday, with Ana and Bea available, the Job on it, and anything else
export const thursday = (over: Partial<ScheduleDay> = {}): ScheduleDay => {
  const { jobs = [], ...rest } = over;
  return {
    date: "2026-01-08",
    staffHours: 16,
    bookedHours: 6,
    heldHours: 0,
    freeHours: 10,
    available: [
      { id: "ana", name: "Ana Ruiz", hours: 8 },
      { id: "bea", name: "Bea Cruz", hours: 8 },
    ],
    held: [],
    siteVisits: [],
    ...rest,
    jobs: jobs.some((j) => j.id === "job") ? jobs : [scheduled(), ...jobs],
  };
};

// the Job as a clean to check: at its own time, not counted against itself
export const clean = {
  startsAt: new Date(THURSDAY_9AM),
  labourHours: 6,
  crewSize: 2,
  jobId: "job",
};
