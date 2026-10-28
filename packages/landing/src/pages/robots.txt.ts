import type { APIRoute } from "astro";
import { business } from "../business.ts";
import { isTestSite } from "../site-mode.ts";

export const GET: APIRoute = () =>
  new Response(
    isTestSite
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\n\nSitemap: ${business.url}sitemap-index.xml\n`,
  );
