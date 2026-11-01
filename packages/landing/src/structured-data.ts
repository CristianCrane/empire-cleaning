import { business } from "./business.ts";
import { services } from "./services.ts";

// what search engines read about the business (#178), built from the same
// facts the page prints so the two can't drift apart. One business node with
// a stable @id that other pages can refer to. No review stars: Google ignores
// a business's own reviews marked up on its own site, and may count them as
// spam.
export const businessId = `${business.url}#business`;

export const structuredData = {
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
      areaServed: business.areas.map(({ name, wiki }) => ({
        "@type": "AdministrativeArea",
        name,
        sameAs: wiki,
      })),
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
  ],
};
