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
  // as on the home page and in the business's search data
  name: string;
  // about 60 characters, the service and place first (#171)
  title: string;
  description: string;
  heading: string;
  intro: string;
  // the neighborhoods or towns we work in
  places: { title: string; list: string[]; note?: string };
  // what the homes there are like, and what that means for a clean
  homes: { title: string; text: string[] };
  // the Services asked for most there, and why
  popular: { title: string; list: { service: string; text: string }[] };
  faqs: { question: string; answer: string }[];
};

export const areas: Area[] = [queens, brooklyn, manhattan, nassau, suffolk];
