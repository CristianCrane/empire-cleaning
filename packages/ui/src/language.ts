import { createContext, useContext } from "react";
import type { Language } from "@empire-cleaning/models";

// The language the app gives the design system (ADR-0025): its own words
// (Close, Next, Back) and every screen built from it follow it. Given by
// LanguageProvider; English where none is given. Kept apart from the
// provider, which brings react-aria's I18nProvider, so a small island (the
// landing site's ThemeToggle) reads it without loading more
export const LanguageContext = createContext<Language>("en");

export const useLanguage = () => useContext(LanguageContext);
