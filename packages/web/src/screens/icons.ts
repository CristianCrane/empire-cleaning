import {
  Ban,
  Building2,
  CircleCheck,
  DoorClosed,
  House,
  MapPinHouse,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { JobStatus, PropertyKind } from "@empire-cleaning/models";

// the one icon for a Quote, wherever a Quote shows: nav, New Quote, rows
export { ClipboardPenLine as QuoteIcon } from "lucide-react";

// the one icon for a Job, wherever Jobs show: nav, rows
export { BrushCleaning as JobIcon } from "lucide-react";

// the one icon for a Property, by its kind, wherever one shows: a house for
// a home, a building for business premises
export const homeIcon = (kind: PropertyKind) =>
  kind === "commercial" ? Building2 : House;

// the one icon for a Site Visit, wherever it shows: its page's tile before
// it has a time, a home's visits and history, the portal's next step, its
// block on the Schedule and its key. A pin, as a visit is someone coming to
// the place, with a house so it isn't the plain pin of a "where" fact
export const SiteVisitIcon = MapPinHouse;

// the one icon for a booked Job still short of cleaners, wherever it shows:
// Today's to-do row, the Schedule's block and its key
export const NeedsCleanersIcon = UserX;

// the one icon for each way a Job ended, wherever it shows: History, the
// Job's facts, the Cleaner's Couldn't get in, the Schedule's block and its
// key. A booked Job has none: it's the usual case
export const jobStatusIcon = {
  completed: CircleCheck,
  cancelled: Ban,
  no_access: DoorClosed,
} satisfies Record<Exclude<JobStatus, "booked">, LucideIcon>;
