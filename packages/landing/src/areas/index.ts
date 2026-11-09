import type { Catalog } from "@empire-cleaning/models";
import type { ServiceKey } from "../services.ts";
import { twin } from "../twin.ts";
import { brooklyn } from "./brooklyn.ts";
import { brooklyn as brooklynEs } from "./brooklyn.es.ts";
import { manhattan } from "./manhattan.ts";
import { manhattan as manhattanEs } from "./manhattan.es.ts";
import { nassau } from "./nassau.ts";
import { nassau as nassauEs } from "./nassau.es.ts";
import { queens } from "./queens.ts";
import { queens as queensEs } from "./queens.es.ts";
import { suffolk } from "./suffolk.ts";
import { suffolk as suffolkEs } from "./suffolk.es.ts";

// a page per area we serve (#176), each in its own words: a page that only
// swaps the place's name in reads to Google as a doorway page, and can sink
// the whole site. The owner edits the words in each area's file, and their
// Spanish in its twin (`queens.es.ts`)
export type Area = {
  // the page's address, /<slug>/ (or /es/<slug>/)
  slug: string;
  // as in the business's search data, with the Wikipedia page that says
  // which place it is (#178)
  name: string;
  wiki: string;
  // in a sentence, as "Queens, Brooklyn, Nassau and western Suffolk"
  short: string;
  // the service and place first; " | Empire Cleaning" follows (#171)
  title: string;
  description: string;
  heading: string;
  intro: string;
  // the neighborhoods or towns we work in
  places: { title: string; list: string[]; note?: string };
  // what the homes there are like, and what that means for a clean
  homes: { title: string; text: string[] };
  // the Services asked for most there, and why
  popular: { title: string; list: { service: ServiceKey; text: string }[] };
  faqs: { question: string; answer: string }[];
};

// what a twin takes from the English: the place itself
const facts = ["wiki"] as const;
export type AreaWords = Omit<Area, (typeof facts)[number]>;

export const areas: Catalog<Area>[] = [
  twin(facts, queens, queensEs),
  twin(facts, brooklyn, brooklynEs),
  twin(facts, manhattan, manhattanEs),
  twin(facts, nassau, nassauEs),
  twin(facts, suffolk, suffolkEs),
];
