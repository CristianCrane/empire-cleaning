import { business as shared, catalog } from "@empire-cleaning/models";

// the facts the page, its search data and its tests all share: the business
// itself (shared with the emails), and how the page presents it. Its words
// in each language are businessWords, below
export const business = {
  ...shared,
  // the name people know it by; `name` is the company's legal name
  brand: "Empire Cleaning & Pro Services",
  hours: {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "08:00",
    closes: "18:00",
  },
  // the crew's languages, as BCP 47 tags
  languages: ["en", "es"],
  // the business's own pages elsewhere, by network: the footer links them,
  // and the search data names them (#223)
  social: {
    facebook: {
      name: "Facebook",
      href: "https://www.facebook.com/empirecleaningsvcs3",
    },
    instagram: {
      name: "Instagram",
      href: "https://www.instagram.com/empirecleaningsvcs3",
    },
    yelp: {
      name: "Yelp",
      href: "https://www.yelp.com/biz/empire-cleaning-and-pro-services-queens",
    },
    google: {
      name: "Google",
      href: "https://www.google.com/maps?cid=17623671204506783546",
    },
  },
} as const;

// the business in words, on the home page and in its search data. The
// Spanish is a draft the owner checks (#206)
export const businessWords = catalog({
  en: {
    // service and place first, the brand last, about 60 characters (#171)
    title: "House Cleaning in Queens, NYC & Long Island | Empire Cleaning",
    // English pages say, in Spanish, that the crew speaks it
    description:
      "House, office and post-construction cleaning in Queens, Brooklyn, Manhattan and Long Island. Se habla español. Request a quote in minutes.",
    // what and where, in the page's heading, under the slogan
    heading:
      "House and office cleaning in Queens, Brooklyn, Manhattan and Long Island",
    hours: "Mon–Sat, 8am–6pm",
  },
  es: {
    title: "Limpieza de casas en Queens, NYC y Long Island | Empire Cleaning",
    description:
      "Limpieza de casas, oficinas y después de obras en Queens, Brooklyn, Manhattan y Long Island. Pida una cotización en minutos.",
    heading:
      "Limpieza de casas y oficinas en Queens, Brooklyn, Manhattan y Long Island",
    hours: "Lun–Sáb, 8 a.m.–6 p.m.",
  },
});
