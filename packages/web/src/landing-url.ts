// the landing site's address, where its policies are (set at build time,
// the same address as the server's LANDING_ORIGIN_URL, in each site's
// Blueprint: render.yaml, render-production.yaml)
export const landingUrl =
  import.meta.env.VITE_LANDING_URL ?? "http://localhost:4321";
