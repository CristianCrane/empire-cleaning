import type { ServiceName } from "../services.ts";
import { deepCleaning } from "./deep-cleaning.ts";
import { disinfecting } from "./disinfecting.ts";
import { moveInMoveOut } from "./move-in-move-out-cleaning.ts";
import { officeCleaning } from "./office-cleaning.ts";
import { postConstruction } from "./post-construction-cleaning.ts";
import { recurringCleaning } from "./recurring-cleaning.ts";
import { standardCleaning } from "./standard-cleaning.ts";

// a page per service (#177), so a search for "deep cleaning" or "move out
// cleaning" lands on a page about exactly that. The owner edits the words in
// each service's file. No prices (#170): what a Quote depends on instead.
export type ServicePage = {
  // the page's address, /services/<slug>/
  slug: string;
  // its card on the home page, which links here
  card: ServiceName;
  // the Office's Service its Quote form starts with, by key. Its name is
  // here so a renamed Service gets its page renamed too; none where the
  // Office has no such Service, and the copy says which to choose
  office?: { key: string; name: string; regular?: boolean };
  // the service and the area; " | Empire Cleaning" follows (#171)
  title: string;
  description: string;
  heading: string;
  intro: string;
  // what's included, room by room ("what does a deep clean include")
  included: {
    title: string;
    rooms: { name: string; items: string[] }[];
    // what isn't, or comes as an Add-on
    note?: string;
  };
  // what the Quote depends on, how long, the Deposit
  pricing: { title: string; text: string[] };
  // who it's for and when to book it
  when: { title: string; text: string[] };
  faqs: { question: string; answer: string }[];
  // other service pages, by slug
  related: string[];
};

export const servicePages: ServicePage[] = [
  deepCleaning,
  standardCleaning,
  recurringCleaning,
  moveInMoveOut,
  postConstruction,
  officeCleaning,
  disinfecting,
];
