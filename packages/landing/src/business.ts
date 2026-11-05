import { business as shared } from "@empire-cleaning/models";
import { areas } from "./areas/index.ts";

// the facts the page, its search data and its tests all share: the business
// itself (shared with the emails), and how the page presents it
export const business = {
  ...shared,
  // the name people know it by; `name` is the company's legal name
  brand: "Empire Cleaning & Pro Services",
  // service and place first, the brand last, about 60 characters (#171)
  title: "House Cleaning in Queens, NYC & Long Island | Empire Cleaning",
  description:
    "House, office and post-construction cleaning in Queens, Brooklyn, Manhattan and Long Island. Se habla español. Request a Quote in minutes.",
  // what and where, in the page's heading, under the slogan
  heading:
    "House and office cleaning in Queens, Brooklyn, Manhattan and Long Island",
  // the area served in full, a page each (#176)
  areas: areas.map(({ slug, name, wiki }) => ({ slug, name, wiki })),
  hours: {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "08:00",
    closes: "18:00",
    display: "Mon–Sat, 8am–6pm",
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
