import { business as shared } from "@empire-cleaning/models";

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
  // the area served in full, each with the Wikipedia page that says which
  // place it is (#178)
  areas: [
    { name: "Queens", wiki: "https://en.wikipedia.org/wiki/Queens" },
    { name: "Brooklyn", wiki: "https://en.wikipedia.org/wiki/Brooklyn" },
    { name: "Manhattan", wiki: "https://en.wikipedia.org/wiki/Manhattan" },
    {
      name: "Nassau County",
      wiki: "https://en.wikipedia.org/wiki/Nassau_County,_New_York",
    },
    {
      // not the East End
      name: "Western Suffolk County",
      wiki: "https://en.wikipedia.org/wiki/Suffolk_County,_New_York",
    },
  ],
  hours: {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "08:00",
    closes: "18:00",
    display: "Mon–Sat, 8am–6pm",
  },
  // the crew's languages, as BCP 47 tags
  languages: ["en", "es"],
} as const;
