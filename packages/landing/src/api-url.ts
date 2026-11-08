// the API's public address, where the Guest form sends what is asked and the
// page's traces lead (set at build time; the test site's in render.yaml).
// astro.config.ts reads its own, at config time, for the
// Content-Security-Policy
export const apiUrl = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000";
