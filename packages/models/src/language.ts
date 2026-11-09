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

// a catalog, its Spanish typed by its English: a Spanish string missing,
// or a function taking other arguments, fails the typecheck rather than
// showing English on a Spanish screen
export const catalog = <T>(words: { en: T; es: NoInfer<T> }): Catalog<T> =>
  words;
