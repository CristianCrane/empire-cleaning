import type { Catalog } from "@empire-cleaning/models";
import type { ServiceKey } from "../services.ts";
import { twin } from "../twin.ts";
import { deepCleaning } from "./deep-cleaning.ts";
import { deepCleaning as deepCleaningEs } from "./deep-cleaning.es.ts";
import { disinfecting } from "./disinfecting.ts";
import { disinfecting as disinfectingEs } from "./disinfecting.es.ts";
import { moveInMoveOut } from "./move-in-move-out-cleaning.ts";
import { moveInMoveOut as moveInMoveOutEs } from "./move-in-move-out-cleaning.es.ts";
import { officeCleaning } from "./office-cleaning.ts";
import { officeCleaning as officeCleaningEs } from "./office-cleaning.es.ts";
import { postConstruction } from "./post-construction-cleaning.ts";
import { postConstruction as postConstructionEs } from "./post-construction-cleaning.es.ts";
import { recurringCleaning } from "./recurring-cleaning.ts";
import { recurringCleaning as recurringCleaningEs } from "./recurring-cleaning.es.ts";
import { standardCleaning } from "./standard-cleaning.ts";
import { standardCleaning as standardCleaningEs } from "./standard-cleaning.es.ts";

// a page per service (#177), so a search for "deep cleaning" or "move out
// cleaning" lands on a page about exactly that. The owner edits the words in
// each service's file, and their Spanish in its twin. No prices (#170): what
// a Quote depends on instead.
export type ServicePage = {
  // the page's address, /services/<slug>/ (or /es/servicios/<slug>/)
  slug: string;
  // its card on the home page, which links here
  card: ServiceKey;
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
    // what isn't, or comes as an extra
    note?: string;
  };
  // what the Quote depends on, how long, the Deposit
  pricing: { title: string; text: string[] };
  // who it's for and when to book it
  when: { title: string; text: string[] };
  faqs: { question: string; answer: string }[];
  // other service pages, by their cards
  related: ServiceKey[];
};

// what a twin takes from the English: which page it is, the Office's
// Service, and the pages it leads to
const facts = ["card", "office", "related"] as const;
export type ServicePageWords = Omit<ServicePage, (typeof facts)[number]>;

export const servicePages: Catalog<ServicePage>[] = [
  twin(facts, deepCleaning, deepCleaningEs),
  twin(facts, standardCleaning, standardCleaningEs),
  twin(facts, recurringCleaning, recurringCleaningEs),
  twin(facts, moveInMoveOut, moveInMoveOutEs),
  twin(facts, postConstruction, postConstructionEs),
  twin(facts, officeCleaning, officeCleaningEs),
  twin(facts, disinfecting, disinfectingEs),
];

// the page a card leads to, where it has one
export const pageOf = (card: ServiceKey) =>
  servicePages.find((p) => p.en.card === card);
