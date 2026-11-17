// Cloudflare Web Analytics (#185): it counts visits, from a
// beacon every page loads (layouts/Page.astro), and only a build with
// PUBLIC_CF_ANALYTICS_TOKEN has it. Dev, the tests and the test site have no
// token, so their pages load and allow none of it. The page's tag and what
// the Content-Security-Policy (astro.config.ts) allows for it both come from
// here, so neither can change without the other. The sources are Cloudflare's
// (developers.cloudflare.com/web-analytics/faq/): the beacon's script, and
// where it sends what it counts.
const BEACON = "https://static.cloudflareinsights.com/beacon.min.js";

export const analytics = (token: string | undefined) =>
  token
    ? {
        beacon: BEACON,
        // the beacon's own attribute, as Cloudflare's snippet has it
        config: JSON.stringify({ token }),
        scriptSrc: [BEACON],
        connectSrc: ["https://cloudflareinsights.com"],
      }
    : null;
