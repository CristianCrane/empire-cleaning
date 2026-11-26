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

// the prototype an address is under, in either language, and the page
// (<layout>-<case>) it asks for there
export const prototypeAt = (pathname: string) => {
  for (const home of Object.values(landingHome)) {
    const under = `${home}prototype/`;
    if (!pathname.startsWith(under)) continue;
    const [screen, page] = pathname.slice(under.length).split("/");
    if (screen) return { screen, page: page || undefined };
  }
  return undefined;
};

// what a page's address asks for that its prototype hasn't, as the index
// says it ("case 99"); the whole address when each part is there but not
// in that language
export const missingAt = (drawn: Prototype, pathname: string) => {
  const page = prototypeAt(pathname)?.page ?? "";
  const dash = page.indexOf("-");
  const layout = page.slice(0, Math.max(dash, 0));
  const shown = page.slice(dash + 1);
  const missing = [
    ...(drawn.cases[shown] ? [] : [`case ${shown}`]),
    ...(drawn.layouts.some(({ key }) => key === layout)
      ? []
      : [`layout ${layout}`]),
  ];
  return dash > 0 && missing.length ? missing : [`page ${pathname}`];
};

// the address of one layout × case of a prototype, in its case's language
export const pageOf =
  (screen: string, drawn: Prototype) => (layout: string, shown: string) =>
    shotPath(screen, layout, shown, drawn.cases[shown]?.lang);

export const shotPath = (
  screen: string,
  layout: string,
  shown: string,
  lang: Language = "en",
) => `${indexPath(screen, lang)}${layout}-${shown}/`;
