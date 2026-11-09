import type { Catalog, Language } from "@empire-cleaning/models";
import type { ServiceKey } from "../services.ts";
import { twin } from "../twin.ts";
import { deepCleanHowOften } from "./how-often-deep-clean.ts";
import { deepCleanHowOften as deepCleanHowOftenEs } from "./how-often-deep-clean.es.ts";
import { houseCleaningCost } from "./house-cleaning-cost.ts";
import { houseCleaningCost as houseCleaningCostEs } from "./house-cleaning-cost.es.ts";

// a few evergreen guides (#180), each answering one question people search
// for, at its own address. Not a blog: only what can be written well. They
// aren't linked from the home page, only from the service pages they
// belong to, so the home page stays quiet. The owner edits the words here,
// and their Spanish in each one's twin
export type Guide = {
  // which guide it is, in either language
  key: "cost" | "how-often";
  // the page's address, /guides/<slug>/ (or /es/guias/<slug>/)
  slug: string;
  // in the breadcrumbs, after Home
  crumb: string;
  // the question as people search it; " | Empire Cleaning" follows
  title: string;
  description: string;
  heading: string;
  intro: string;
  // when it was first written, for search engines (YYYY-MM-DD)
  published: string;
  sections: { title: string; text: string[]; list?: string[] }[];
  // the service pages that link here, under which of their sections
  linkedFrom: { service: ServiceKey; under: "pricing" | "when" }[];
  // and in what words
  link: string;
};

export type GuideKey = Guide["key"];

// what a twin takes from the English
const facts = ["key", "published", "linkedFrom"] as const;
export type GuideWords = Omit<Guide, (typeof facts)[number]>;

export const guides: Catalog<Guide>[] = [
  twin(facts, houseCleaningCost, houseCleaningCostEs),
  twin(facts, deepCleanHowOften, deepCleanHowOftenEs),
];

// the guides a service page links to, under one of its sections
export const guidesFor = (
  service: ServiceKey,
  under: "pricing" | "when",
  lang: Language,
) =>
  guides
    .map((guide) => guide[lang])
    .filter((guide) =>
      guide.linkedFrom.some((l) => l.service === service && l.under === under),
    );
