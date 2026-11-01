import { business } from "./business.ts";
import type { Area } from "./areas/index.ts";
import type { ServicePage } from "./service-pages/index.ts";
import { services } from "./services.ts";

// what search engines read about the business (#178), built from the same
// facts the page prints so the two can't drift apart. One business node with
// a stable @id that other pages can refer to. No review stars: Google ignores
// a business's own reviews marked up on its own site, and may count them as
// spam.
export const businessId = `${business.url}#business`;

const place = ({ name, wiki }: { name: string; wiki: string }) => ({
  "@type": "AdministrativeArea",
  name,
  sameAs: wiki,
});

// every page carries the business in full, so whichever page a search engine
// reads first, it has it; then whatever is particular to that page
export const structuredData = (page: object[] = []) => ({
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
      description: business.description,
      logo: new URL("email-logo.png", business.url).href,
      image: new URL("og-image.png", business.url).href,
      // a service-area business publishes no street address
      address: {
        "@type": "PostalAddress",
        addressLocality: "Queens",
        addressRegion: "NY",
        addressCountry: "US",
      },
      areaServed: business.areas.map(place),
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
        name: "Cleaning services",
        itemListElement: services.map(({ name, text }) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name, description: text },
        })),
      },
    },
    {
      "@type": "WebSite",
      "@id": `${business.url}#website`,
      name: business.brand,
      url: business.url,
      publisher: { "@id": businessId },
    },
    ...page,
  ],
});

// the way back from a page to the home page, as its breadcrumbs show
const crumbs = (name: string, url: string) => ({
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: business.url },
    { "@type": "ListItem", position: 2, name, item: url },
  ],
});

// an area's page (#176): its breadcrumbs, and cleaning there, provided by
// the business, referred to by its @id
export const areaData = (area: Area) => {
  const url = new URL(`${area.slug}/`, business.url).href;
  return [
    crumbs(area.name, url),
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name: area.heading,
      description: area.description,
      serviceType: "House cleaning",
      url,
      provider: { "@id": businessId },
      areaServed: place(area),
    },
  ];
};

// a service's page (#177): its breadcrumbs, and the service, provided by
// the business across the area it serves
export const serviceData = (page: ServicePage) => {
  const url = new URL(`services/${page.slug}/`, business.url).href;
  return [
    crumbs(page.card, url),
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name: page.heading,
      description: page.description,
      serviceType: page.card,
      url,
      provider: { "@id": businessId },
      areaServed: business.areas.map(place),
    },
  ];
};
