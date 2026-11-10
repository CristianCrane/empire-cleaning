// The languages a Guest, Client or Cleaner reads the product in (ADR-0025):
// each sees English or Spanish, the Office English

export type Language = "en" | "es";

export const LANGUAGES = ["en", "es"] as const satisfies Language[];

// each language's locale, for Intl: dates, money, numbers and plurals.
// Neutral Latin American Spanish, as it's written in the United States
export const locales: Record<Language, string> = { en: "en-US", es: "es-US" };

// the language a BCP 47 tag ("es-MX", "en") asks for: Spanish for any
// Spanish, otherwise English
export const languageOf = (tag: string | null | undefined): Language =>
  tag?.trim().toLowerCase().startsWith("es") ? "es" : "en";

// words in each language, side by side, looked up by the reader's language
// (`words[lang]`)
export type Catalog<T> = Record<Language, T>;

// the type of a catalog's words, from its English: a function's words any
// string, not the English ones ("this home" | "this business")
export type Words<T> = T extends (...args: infer A) => string
  ? (...args: A) => string
  : T extends object
    ? { [K in keyof T]: Words<T[K]> }
    : T;

// a catalog, its Spanish typed by its English: a Spanish string missing,
// or a function taking other arguments, fails the typecheck rather than
// showing English on a Spanish screen
export const catalog = <T>(words: {
  en: T;
  es: NoInfer<Words<T>>;
}): Catalog<Words<T>> => words as Catalog<Words<T>>;

// what the Office names in both languages (a Service, an Add-on, a Premises
// Type), as a reader of `lang` sees it: the Spanish name and description
// where they're set, the English otherwise (ADR-0025)
type Named = {
  name: string;
  nameEs?: string | null;
  description?: string;
  descriptionEs?: string | null;
};
export const inLanguage = <T extends Named>(lang: Language, item: T): T =>
  lang === "en"
    ? item
    : {
        ...item,
        name: item.nameEs || item.name,
        ...(item.description !== undefined && {
          description: item.descriptionEs || item.description,
        }),
      };
