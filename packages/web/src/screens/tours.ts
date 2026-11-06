import type { AreaId } from "../session.ts";
import { clientTours } from "./portal/tours.ts";

// First-time help (#291): a short spotlight tour of a screen, shown once, the
// first time it matters (not the test site's tours of its demo people). Each
// area's tours are plain data in one file, run by useTours (run-tours.ts);
// the e2e harness and tours spec read them too, so nothing here may import
// what only a browser can run.

// what a step points at, found by the screen's own words, so no screen
// carries anything for its tour: a link (or ButtonLink, or shortcut) whose
// text starts with these words, or a Section with this title
export type Target = { link: string } | { section: string };

type TourStep = { target: Target; title: string; text: string };

type Tour = {
  // what the Account remembers it by: lowercase letters, digits and dashes
  id: string;
  // the screen it's for, its route as the router writes it
  route: string;
  // one to three. The tour runs only once every one is on the screen, which
  // is what "the first time it matters" means for that screen
  steps: TourStep[];
};

export type AreaTours = {
  // the area's one line of value, leading whichever tour a person meets first
  welcome: string;
  tours: Tour[];
};

// the Office's come in #295, the Cleaner area's in #296
export const toursFor: Partial<Record<AreaId, AreaTours>> = {
  portal: clientTours,
};

export const tourIds = Object.values(toursFor).flatMap((area) =>
  area.tours.map((tour) => tour.id),
);
