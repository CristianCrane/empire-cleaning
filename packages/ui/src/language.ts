import { createContext, useContext } from "react";
import { catalog, type Language, upperFirst } from "@empire-cleaning/models";

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
    // the rail's way to the account's parts (AppLayout)
    account: "Account",
    next: "Next",
    back: "Back",
    gotIt: "Got it",
    // driver.js fills in the numbers
    progress: "{{current}} of {{total}}",
    darkTheme: "Dark theme",
    testSite: "Test site: no real payments or cleans",
    goHome: "Go to your home page",
    // a Home's greeting, by the person's first name
    hi: (name: string) => `Hi, ${name}`,
    // what a page can do besides its next step, behind its split button's
    // arrow, or behind a ⋯ when nothing is next (PageActions)
    moreActions: "More actions",
    // a phone's sheet of a page's actions, closed with nothing done
    cancel: "Cancel",
    // a Record's bar at a phone's foot, holding its next step
    whatToDo: "What to do",
    history: "History",
    // the alerts a Record holds back, all at once
    showMore: (n: number) => `Show ${n} more`,
    // a list's next page, and how many are past it
    showMoreLeft: (n: string) => `Show more (${n} left)`,
    // a list's search, which looks through every Tab
    found: (n: number) => `${n} found in every tab`,
    noMatch: (q: string) => `Nothing matches “${q}”`,
    clearSearch: "Clear search",
    // a Settings list's retired rows, folded
    retired: (n: number) => `Retired (${n})`,
    // the next page, on its way (AppLayout)
    loading: "Loading…",
    // a Job's crew (CrewSection): where it stands, a zero left unsaid ("2
    // needed", "1 of 2 confirmed, 1 needed"); a Cleaner Needed, by the
    // glossary's word, and what a screen reader hears of it; what it hears
    // of each face
    crewLine: (confirmed: number, of: number, needed: number) =>
      needed === 0
        ? `${confirmed} of ${of} confirmed`
        : confirmed === 0
          ? `${needed} needed`
          : `${confirmed} of ${of} confirmed, ${needed} needed`,
    needed: "Needed",
    cleanerNeeded: "a cleaner still needed",
    confirmed: "confirmed",
    notConfirmedYet: "not confirmed yet",
  },
  es: {
    close: "Cerrar",
    dismiss: "Descartar",
    menu: "Menú",
    account: "Cuenta",
    next: "Siguiente",
    back: "Atrás",
    gotIt: "Entendido",
    progress: "{{current}} de {{total}}",
    darkTheme: "Tema oscuro",
    testSite: "Sitio de prueba: sin pagos ni limpiezas reales",
    goHome: "Ir a la página de inicio",
    hi: (name: string) => `Hola, ${name}`,
    moreActions: "Más acciones",
    cancel: "Cancelar",
    whatToDo: "Qué hacer",
    history: "Historial",
    showMore: (n: number) => `Ver ${n} más`,
    showMoreLeft: (n: string) => `Ver más (quedan ${n})`,
    found: (n: number) =>
      n === 1
        ? "1 encontrado en todas las pestañas"
        : `${n} encontrados en todas las pestañas`,
    noMatch: (q: string) => `Nada coincide con “${q}”`,
    clearSearch: "Borrar la búsqueda",
    retired: (n: number) => `Retirados (${n})`,
    loading: "Cargando…",
    crewLine: (confirmed: number, of: number, needed: number) => {
      const falta = `${needed === 1 ? "falta" : "faltan"} ${needed}`;
      const done = `${confirmed} de ${of} ${of === 1 ? "confirmado" : "confirmados"}`;
      return needed === 0
        ? done
        : confirmed === 0
          ? upperFirst(falta)
          : `${done}, ${falta}`;
    },
    needed: "Falta",
    cleanerNeeded: "aún falta un limpiador",
    confirmed: "confirmado",
    notConfirmedYet: "aún sin confirmar",
  },
});

// the design system's words in the language it's given
export const useUiWords = () => uiWords[useLanguage()];
