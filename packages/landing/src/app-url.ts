// the web app's address, where Clients sign in (set at build time; the test
// site's in render.yaml). Its home sends someone signed in on to their own
// home, anyone else to sign in.
export const appUrl = import.meta.env.PUBLIC_APP_URL ?? "http://localhost:5173";
