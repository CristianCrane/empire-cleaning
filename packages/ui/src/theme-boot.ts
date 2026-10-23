// no imports: this runs in build configs and inline in <head>, not only in React
export const THEME_STORAGE_KEY = "ec-theme";

// inline in each page's <head>, so a pinned theme applies before first paint
// and never flashes the other one
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
