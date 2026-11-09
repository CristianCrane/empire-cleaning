import {
  catalog,
  type Catalog,
  type Language,
  LANGUAGES,
} from "@empire-cleaning/models";
import { areas, type Area } from "./areas/index.ts";
import { guides, type GuideKey } from "./guides/index.ts";
import { pageOf, servicePages } from "./service-pages/index.ts";
import type { ServiceKey } from "./services.ts";

// Every page, by what it's of, and its address in each language (ADR-0025):
// in English at its address, in Spanish under /es/ with its words' own
// slugs. The routes, the head's canonical and hreflang links, the search
// data, every link between pages, the language switch and the tests all
// take a page's address from pathOf, so none is written by hand.
export type Page =
  | { kind: "home" }
  | { kind: "area"; area: Catalog<Area> }
  | { kind: "service"; service: ServiceKey }
  | { kind: "guide"; guide: GuideKey };

const home = catalog({ en: "/", es: "/es/" });
const folders = catalog({
  en: { services: "services", guides: "guides" },
  es: { services: "servicios", guides: "guias" },
});

export const pathOf = (page: Page, lang: Language): string => {
  switch (page.kind) {
    case "home":
      return home[lang];
    case "area":
      return `${home[lang]}${page.area[lang].slug}/`;
    case "service":
      return `${home[lang]}${folders[lang].services}/${pageOf(page.service)![lang].slug}/`;
    case "guide":
      return `${home[lang]}${folders[lang].guides}/${guides.find((g) => g.en.key === page.guide)![lang].slug}/`;
  }
};

// every page there is, each in both languages (the 404 is no page's
// address)
export const pages: Page[] = [
  { kind: "home" },
  ...areas.map((area) => ({ kind: "area" as const, area })),
  ...servicePages.map((p) => ({
    kind: "service" as const,
    service: p.en.card,
  })),
  ...guides.map((g) => ({ kind: "guide" as const, guide: g.en.key })),
];

// a route's pages in both languages, for its getStaticPaths: its rest
// parameter, named for the kind of page (pages/[...area].astro), is the
// address without its slashes (none for the home page).
// A page's language is then Astro.currentLocale (languageOf)
export const routesOf = <K extends Page["kind"]>(kind: K) =>
  LANGUAGES.flatMap((lang) =>
    pages
      .filter((page): page is Extract<Page, { kind: K }> => page.kind === kind)
      .map((page) => ({
        params: {
          [kind]: pathOf(page, lang).slice(1, -1) || undefined,
        } as Record<K, string | undefined>,
        props: { page },
      })),
  );
