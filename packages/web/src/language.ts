import { useSyncExternalStore } from "react";
import { LANGUAGES, type Language, languageOf } from "@empire-cleaning/models";
import { readStored, store } from "@empire-cleaning/ui";

// The language the app's screens are in now (ADR-0025): one store, which
// the routes set as they decide it (router.tsx), the API is told on every
// request (as otherwise the browser says its own, api.ts and session.ts),
// React reads (Root gives it to the design system's LanguageProvider) and
// the page's `<html lang>` says.
let current: Language = "en";
const listeners = new Set<() => void>();

const appLanguage = () => current;

export const setAppLanguage = (lang: Language) => {
  if (lang === current) return;
  current = lang;
  document.documentElement.lang = lang;
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useAppLanguage = () =>
  useSyncExternalStore(subscribe, appLanguage);

// what tells the API the screen's language, on each request
export const languageHeader = () => ({ "accept-language": appLanguage() });

// Before sign-in, a screen is in the language of the page the person came
// from: the landing site's Spanish pages link here with ?lang=es, which is
// remembered in this browser so the sign-in link it emails opens in it too.
// Without one, the browser's.
const STORAGE_KEY = "language";
const isLanguage = (value: string | null): value is Language =>
  LANGUAGES.some((lang) => lang === value);

export const rememberPageLanguage = (search: string) => {
  const asked = new URLSearchParams(search).get("lang");
  if (isLanguage(asked)) store("localStorage", STORAGE_KEY, asked);
};

export const signedOutLanguage = (): Language => {
  const remembered = readStored("localStorage", STORAGE_KEY);
  return isLanguage(remembered) ? remembered : languageOf(navigator.language);
};
