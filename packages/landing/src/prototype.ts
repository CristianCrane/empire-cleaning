import { landingHome, type Language } from "@empire-cleaning/models";

// A landing prototype (docs/ux.md, Changing a screen), on a prototype-*
// branch: `src/prototypes/<screen>.ts` default-exports prototype({ layouts,
// cases }), and `src/prototypes/<screen>.astro` draws one, given `layout`
// and `case` as props, inside the site's Page. src/pages/[...prototype].astro
// makes a page of each layout × case, at /prototype/<screen>/<layout>-<case>/,
// a Spanish case's under /es/, as a page's language is its address
// (ADR-0025); and at /prototype/<screen>/ an index linking every one, which
// `pnpm pr:shots --prototype <screen>` shoots one by one
// (packages/server/tests/e2e/prototype-shots.ts)
export type Prototype = {
  layouts: { key: string; name: string }[];
  cases: Record<string, { name: string; lang?: Language }>;
};

/** @public what a prototype's list default-exports, its layouts in order */
export const prototype = (drawn: Prototype) => drawn;

// a prototype's address, its index's (the English one, as the list is
// the kit's, not the site's) and each layout × case's
export const indexPath = (screen: string, lang: Language = "en") =>
  `${landingHome[lang]}prototype/${screen}/`;

export const shotPath = (
  screen: string,
  layout: string,
  shown: string,
  lang: Language = "en",
) => `${indexPath(screen, lang)}${layout}-${shown}/`;
