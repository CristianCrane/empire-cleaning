import {
  type Catalog,
  formats,
  type Language,
  messages,
} from "@empire-cleaning/models";
import { useLanguage } from "@empire-cleaning/ui";
import { screenWords } from "./format.ts";
import { portalWords } from "./portal/words.ts";

// Everything a screen says that isn't its own: models' formats and shared
// messages, web's screen words and the portal's shared words, in one
// language (ADR-0025)
const saidIn = (lang: Language) => ({
  lang,
  ...formats[lang],
  ...messages[lang],
  ...screenWords[lang],
  p: portalWords[lang],
});

export const said = { en: saidIn("en"), es: saidIn("es") };

export type Said = (typeof said)["en"];

// a screen's own words (`w`) and the rest of what it says, in one
// language: for what a screen works out outside React (whats-next.ts)
export const saidWith = <T>(lang: Language, words: Catalog<T>) => ({
  ...said[lang],
  w: words[lang],
});

// the same, in the language the screen is shown in
export const useSaid = <T>(words: Catalog<T>) => saidWith(useLanguage(), words);

// the rest of what a screen says, for a part with no words of its own
export const useShared = () => said[useLanguage()];
