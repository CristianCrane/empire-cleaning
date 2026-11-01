import type { Area } from "./index.ts";

export const manhattan: Area = {
  slug: "manhattan",
  name: "Manhattan",
  wiki: "https://en.wikipedia.org/wiki/Manhattan",
  short: "Manhattan",
  title: "Apartment Cleaning in Manhattan, NY",
  description:
    "Apartment, co-op and office cleaning in Manhattan, from Harlem to the Financial District. Building paperwork handled. Se habla español. Request a Quote.",
  heading: "Apartment and office cleaning in Manhattan",
  intro:
    "Manhattan apartments are small, busy and in buildings with rules. We clean them properly, work around the doorman and the paperwork, and keep offices clean after everyone's gone home.",
  places: {
    title: "Where we clean in Manhattan",
    list: [
      "Washington Heights",
      "Harlem",
      "Upper West Side",
      "Upper East Side",
      "Midtown",
      "Hell's Kitchen",
      "Murray Hill",
      "Gramercy",
      "Chelsea",
      "Flatiron",
      "Greenwich Village",
      "East Village",
      "Lower East Side",
      "SoHo",
      "Tribeca",
      "Financial District",
    ],
    note: "We cover the whole island, from Inwood to Battery Park.",
  },
  homes: {
    title: "Doorman buildings, co-ops and walk-ups",
    text: [
      "Most of our Manhattan Clients live in a building with rules: a co-op board, a managing agent, a doorman who needs to know we're coming. Many ask for a certificate of insurance before anyone works in an apartment, and some only allow work on weekdays or through the service entrance. Tell us your building's rules when you request a Quote and we'll have the paperwork in before the first clean.",
      "A smaller apartment doesn't mean a quicker clean. A studio's kitchen is also its living room, and a city apartment gathers soot on the sills and grime on the windows faster than you'd think. We clean it all, and leave it the way the building expects it, with the trash taken where it goes.",
      "You don't need to be home. Leave a key with the doorman or tell us how to get in, and we'll lock up when we're done.",
    ],
  },
  popular: {
    title: "What Manhattan asks us for most",
    list: [
      {
        service: "Recurring service",
        text: "A weekly or bi-weekly clean while you're at work, the same day each time, 10% off every visit after the first.",
      },
      {
        service: "Move-in and move-out",
        text: "Leases turn over all year. We clean the empty apartment for the final walk-through or for your first night in.",
      },
      {
        service: "Office cleaning",
        text: "Offices in Midtown, Flatiron and the Financial District, cleaned after hours on the days you choose. We visit first to see the space, for free.",
      },
      {
        service: "Residential deep cleaning",
        text: "Inside the oven and cabinets, the window tracks and sills, behind the fridge: a first clean that resets the whole apartment.",
      },
    ],
  },
  faqs: [
    {
      question: "My co-op needs a certificate of insurance. Can you send one?",
      answer:
        "Yes. Put your managing agent's details in the note on your Quote Request and we'll send the certificate to them before your first clean.",
    },
    {
      question: "Can you clean while I'm at work?",
      answer:
        "Yes, most of our Manhattan Clients are out when we come. Leave a key with your doorman or tell us how we get in, and we'll lock up afterwards.",
    },
    {
      question: "How does office cleaning work?",
      answer:
        "Request a Quote for business premises and choose the days and time you'd like us. We visit the space first, for free, to see what it needs, then send you a Quote.",
    },
    {
      question: "Do you speak Spanish?",
      answer:
        "Sí. Our crew speaks English and Spanish, so you can talk to us in whichever you prefer.",
    },
  ],
};
