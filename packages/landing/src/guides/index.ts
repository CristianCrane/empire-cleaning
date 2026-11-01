import { deepCleanHowOften } from "./how-often-deep-clean.ts";
import { houseCleaningCost } from "./house-cleaning-cost.ts";

// a few evergreen guides (#180), each answering one question people search
// for, at its own address. Not a blog: only what can be written well. They
// aren't linked from the home page, only from the service pages they
// belong to, so the home page stays quiet. The owner edits the words here
export type Guide = {
  // the page's address, /guides/<slug>/
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
  // the service pages that link here, under which of their sections, in
  // what words
  linkedFrom: { service: string; under: "pricing" | "when"; text: string }[];
};

export const guides: Guide[] = [houseCleaningCost, deepCleanHowOften];

// the guides a service page links to, under one of its sections
export const guidesFor = (service: string, under: "pricing" | "when") =>
  guides.flatMap((guide) =>
    guide.linkedFrom
      .filter((l) => l.service === service && l.under === under)
      .map(({ text }) => ({ href: `/guides/${guide.slug}/`, text })),
  );
