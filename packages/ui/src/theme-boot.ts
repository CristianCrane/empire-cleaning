// no imports: this runs in build configs and inline in <head>, not only in React
export const THEME_STORAGE_KEY = "ec-theme";

// inline in each page's <head>, so a chosen dark theme applies before first
// paint instead of flashing light
export const themeBootScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`;
