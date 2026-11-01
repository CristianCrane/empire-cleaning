import type { ServiceName } from "../services.ts";
import { brooklyn } from "./brooklyn.ts";
import { manhattan } from "./manhattan.ts";
import { nassau } from "./nassau.ts";
import { queens } from "./queens.ts";
import { suffolk } from "./suffolk.ts";

// a page per area we serve (#176), each in its own words: a page that only
// swaps the place's name in reads to Google as a doorway page, and can sink
// the whole site. The owner edits the words in each area's file.
export type Area = {
  // the page's address, /<slug>/
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
  // the Services asked for most there, and why, by their names on the home page
  popular: { title: string; list: { service: ServiceName; text: string }[] };
  faqs: { question: string; answer: string }[];
};

export const areas: Area[] = [queens, brooklyn, manhattan, nassau, suffolk];
