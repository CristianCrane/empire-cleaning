import {
  type Catalog,
  type Language,
  LANGUAGES,
} from "@empire-cleaning/models";
import { areas, type Area } from "./areas/index.ts";
import { business, businessWords } from "./business.ts";
import type { Guide } from "./guides/index.ts";
import { urlOf } from "./routes.ts";
import type { ServicePage } from "./service-pages/index.ts";
import { serviceWords, services } from "./services.ts";
import { words } from "./words.ts";

// what search engines read about the business (#178), built from the same
// facts the page prints so the two can't drift apart, in the page's
// language. One business node with a stable @id that other pages can refer
// to. No review stars: Google ignores a business's own reviews marked up on
// its own site, and may count them as spam.
const businessId = `${business.url}#business`;

// a place, by its English name, which says which place it is
const place = ({ name, wiki }: Area) => ({
  "@type": "AdministrativeArea",
  name,
  sameAs: wiki,
});
const everyArea = areas.map((area) => place(area.en));

// every page carries the business in full, so whichever page a search engine
// reads first, it has it; then whatever is particular to that page
export const structuredData = (lang: Language, page: object[] = []) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      // schema.org has no cleaning-service type; this is the nearest
      "@type": "HomeAndConstructionBusiness",
      "@id": businessId,
      name: business.brand,
      legalName: business.name,
      url: business.url,
      telephone: business.phone.e164,
      description: businessWords[lang].description,
      logo: new URL("email-logo.png", business.url).href,
      image: new URL("og-image.png", business.url).href,
      // a service-area business publishes no street address
      address: {
        "@type": "PostalAddress",
        addressLocality: "Queens",
        addressRegion: "NY",
        addressCountry: "US",
      },
      areaServed: everyArea,
      // its own pages elsewhere, so they're known to be the same business
      sameAs: Object.values(business.social).map(({ href }) => href),
      openingHoursSpecification: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: business.hours.days,
        opens: business.hours.opens,
        closes: business.hours.closes,
      },
      priceRange: "$$",
      knowsLanguage: business.languages,
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: words[lang].cleaningServices,
        itemListElement: services.map(({ key }) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: serviceWords[lang][key].name,
            description: serviceWords[lang][key].text,
          },
        })),
      },
    },
    {
      "@type": "WebSite",
      "@id": `${business.url}#website`,
      name: business.brand,
      url: business.url,
      // the site is in both (ADR-0025)
      inLanguage: [...LANGUAGES],
      publisher: { "@id": businessId },
    },
    ...page,
  ],
});

// the way back from a page to its home page, as its breadcrumbs show
const crumbs = (lang: Language, name: string, url: string) => ({
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: words[lang].home,
      item: urlOf({ kind: "home" }, lang),
    },
    { "@type": "ListItem", position: 2, name, item: url },
  ],
});

// an area's page (#176): its breadcrumbs, and cleaning there, provided by
// the business, referred to by its @id
export const areaData = (area: Catalog<Area>, lang: Language) => {
  const url = urlOf({ kind: "area", area: area.en.key }, lang);
  return [
    crumbs(lang, area[lang].name, url),
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name: area[lang].heading,
      description: area[lang].description,
      serviceType: words[lang].houseCleaning,
      url,
      provider: { "@id": businessId },
      areaServed: place(area.en),
    },
  ];
};

// a service's page (#177): its breadcrumbs, and the service, provided by
// the business across the area it serves
export const serviceData = (page: ServicePage, lang: Language) => {
  const url = urlOf({ kind: "service", service: page.card }, lang);
  const name = serviceWords[lang][page.card].name;
  return [
    crumbs(lang, name, url),
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name: page.heading,
      description: page.description,
      serviceType: name,
      url,
      provider: { "@id": businessId },
      areaServed: everyArea,
    },
  ];
};

// a guide (#180): its breadcrumbs, and the article, written and published
// by the business, in the page's language
export const guideData = (guide: Guide, lang: Language) => {
  const url = urlOf({ kind: "guide", guide: guide.key }, lang);
  return [
    crumbs(lang, guide.crumb, url),
    {
      "@type": "Article",
      "@id": `${url}#article`,
      headline: guide.heading,
      description: guide.description,
      inLanguage: lang,
      url,
      mainEntityOfPage: url,
      datePublished: guide.published,
      image: new URL("og-image.png", business.url).href,
      author: { "@id": businessId },
      publisher: { "@id": businessId },
    },
  ];
};
