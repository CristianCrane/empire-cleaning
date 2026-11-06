import type { AreaId } from "../session.ts";
import { officeTours } from "./office/tours.ts";
import { clientTours } from "./portal/tours.ts";

// First-time help (#291): a short spotlight tour of a screen, shown once, the
// first time it matters (not the test site's tours of its demo people). Each
// area's tours are plain data in one file, run by useTours (run-tours.ts);
// the e2e harness and tours spec read them too, so nothing here may import
// what only a browser can run.

// what a step points at, found by the screen's own words, so no screen
// carries anything for its tour: something pressed (a link, Button,
// ButtonLink or shortcut) whose text starts with these words, or a part
// (a Section, a labelled group) whose name does. The first such in the page
// is the one, so a part is found before anything named like it inside it
export type Target = { press: string } | { named: string };

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
  // the area's one line of value, leading the first of its tours a person
  // meets
  welcome: string;
  tours: Tour[];
};

// the Cleaner area's come in #296
export const toursFor: Partial<Record<AreaId, AreaTours>> = {
  portal: clientTours,
  office: officeTours,
};

export const tourIds = Object.values(toursFor).flatMap((area) =>
  area.tours.map((tour) => tour.id),
);
