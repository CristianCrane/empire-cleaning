import { createContext, useContext } from "react";
import { catalog, type Language } from "@empire-cleaning/models";

// The language the app gives the design system (ADR-0025): its own words
// (Close, Next, Back) and every screen built from it follow it. Given by
// LanguageProvider; English where none is given. Kept apart from the
// provider, which brings react-aria's I18nProvider, so a small island (the
// landing site's ThemeToggle) reads it without loading more
export const LanguageContext = createContext<Language>("en");

export const useLanguage = () => useContext(LanguageContext);

// the design system's own words, in each language
export const uiWords = catalog({
  en: {
    close: "Close",
    dismiss: "Dismiss",
    menu: "Menu",
    next: "Next",
    back: "Back",
    gotIt: "Got it",
    // driver.js fills in the numbers
    progress: "{{current}} of {{total}}",
    darkTheme: "Dark theme",
    testSite: "Test site: no real payments or cleans",
  },
  es: {
    close: "Cerrar",
    dismiss: "Descartar",
    menu: "Menú",
    next: "Siguiente",
    back: "Atrás",
    gotIt: "Entendido",
    progress: "{{current}} de {{total}}",
    darkTheme: "Tema oscuro",
    testSite: "Sitio de prueba: sin pagos ni limpiezas reales",
  },
});

// the design system's words in the language it's given
export const useUiWords = () => uiWords[useLanguage()];
