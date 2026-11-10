import type { Catalog } from "@empire-cleaning/models";

// a page's content in English and Spanish (ADR-0025): the Spanish twin has
// the English module's every word, typed by it, and takes its facts (a
// link, a key, a date) from it, so a fact is written once
export const twin = <T extends object, F extends keyof T>(
  facts: readonly F[],
  en: T,
  es: Omit<T, F>,
): Catalog<T> => ({
  en,
  es: {
    ...es,
    ...Object.fromEntries(facts.map((fact) => [fact, en[fact]])),
  } as T,
});
