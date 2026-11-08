import type { QuoteSource } from "@empire-cleaning/models";
import { readStored, store } from "@empire-cleaning/ui";

// Where a Guest asks for a Quote from (#185): this page, and the campaign
// tags (utm_source, utm_medium, utm_campaign) of the link that brought them
// to the site. The tags are kept for the visit, so asking from another page
// than the one the link opened still counts as from that link. Cloudflare's
// analytics counts visits; this says which pages and links bring Quote
// Requests.
const KEY = "ec-utm";
const TAGS = ["source", "medium", "campaign"] as const;

type Tags = Pick<QuoteSource, "utmSource" | "utmMedium" | "utmCampaign">;

const tagsOf = (search: string): Tags | null => {
  const params = new URLSearchParams(search);
  if (!TAGS.some((t) => params.get(`utm_${t}`))) return null;
  const tag = (t: (typeof TAGS)[number]) =>
    params.get(`utm_${t}`)?.slice(0, 100) || null;
  return {
    utmSource: tag("source"),
    utmMedium: tag("medium"),
    utmCampaign: tag("campaign"),
  };
};

// a link with tags opened this page: keep them for the visit. Storage may
// be blocked (a private window), and then only this page knows them
export const keepCampaign = () => {
  const tags = tagsOf(location.search);
  if (tags) store("sessionStorage", KEY, JSON.stringify(tags));
};

const keptCampaign = (): Tags | null => {
  const kept = readStored("sessionStorage", KEY);
  if (!kept) return null;
  try {
    return JSON.parse(kept) as Tags;
  } catch {
    return null;
  }
};

export const quoteSource = (): QuoteSource => ({
  page: location.pathname,
  ...(tagsOf(location.search) ??
    keptCampaign() ?? { utmSource: null, utmMedium: null, utmCampaign: null }),
});
