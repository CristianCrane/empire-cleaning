import { useSyncExternalStore } from "react";
import type { Language } from "@empire-cleaning/models";

// The language the app's screens are in now (ADR-0025): one store, which
// the routes set as they decide it, the API is told on every request (as
// otherwise the browser says its own, api.ts and session.ts), React reads
// (Root gives it to the design system's LanguageProvider) and the page's
// `<html lang>` says.
// English until a route decides (#303)
const current: Language = "en";
const listeners = new Set<() => void>();

const appLanguage = () => current;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useAppLanguage = () =>
  useSyncExternalStore(subscribe, appLanguage);

// what tells the API the screen's language, on each request
export const languageHeader = () => ({ "accept-language": appLanguage() });
