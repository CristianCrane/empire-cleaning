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
    goHome: "Go to your home page",
    // a page's actions, in the menu at the end of its title row
    actions: "Actions",
    history: "History",
    // the alerts a Record holds back, all at once
    showMore: (n: number) => `Show ${n} more`,
    // a list's next page, and how many are past it
    showMoreLeft: (n: string) => `Show more (${n} left)`,
    // a list's search, which looks through every Tab
    found: (n: number) => `${n} found in every tab`,
    noMatch: (q: string) => `Nothing matches “${q}”`,
    clearSearch: "Clear search",
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
    goHome: "Ir a la página de inicio",
    actions: "Acciones",
    history: "Historial",
    showMore: (n: number) => `Ver ${n} más`,
    showMoreLeft: (n: string) => `Ver más (quedan ${n})`,
    found: (n: number) =>
      n === 1
        ? "1 encontrado en todas las pestañas"
        : `${n} encontrados en todas las pestañas`,
    noMatch: (q: string) => `Nada coincide con “${q}”`,
    clearSearch: "Borrar la búsqueda",
  },
});

// the design system's words in the language it's given
export const useUiWords = () => uiWords[useLanguage()];
