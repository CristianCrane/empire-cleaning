import type { ServicePage } from "./index.ts";
import { officeServices } from "./shared.ts";

export const officeCleaning: ServicePage = {
  slug: "office-cleaning",
  card: "Office cleaning",
  office: officeServices.commercial,
  title: "Office Cleaning in Queens, NYC & Long Island",
  description:
    "Office and commercial cleaning in Queens, Brooklyn, Manhattan and Long Island, on the days and times you choose. A free Site Visit first. Request a Quote.",
  heading: "Office and commercial cleaning",
  intro:
    "Workspaces, kitchens and restrooms kept clean for your team and your visitors, on the days you choose, after hours if you like. We visit first, for free, to see the space.",
  included: {
    title: "What office cleaning includes",
    rooms: [
      {
        name: "Workspaces",
        items: [
          "Desks and tables wiped where they're clear",
          "Bins emptied and relined",
          "Floors vacuumed and mopped",
          "Glass, partitions and mirrors shined",
        ],
      },
      {
        name: "Kitchens and break rooms",
        items: [
          "Counters, sinks and tables cleaned",
          "Outside of the appliances wiped",
          "Floor mopped",
        ],
      },
      {
        name: "Restrooms",
        items: [
          "Toilets, sinks and fixtures cleaned",
          "Mirrors shined",
          "Floor mopped",
        ],
      },
      {
        name: "Entrances and shared spaces",
        items: [
          "Reception and waiting areas tidied and dusted",
          "Door handles, switches and railings wiped",
          "Glass doors cleaned",
        ],
      },
    ],
    note: "Every space is different, and the Site Visit is where we agree exactly what's cleaned.",
  },
  pricing: {
    title: "How it's priced",
    text: [
      "Request a Quote for business premises and tell us the type of premises (an office, a medical practice, a shop), roughly how big it is, and the days and time you'd like us. We then visit the space, for free, to see what it needs.",
      "Your Quote is priced from what we find: the floor area, the type of premises and how often we come. Accept it online and pay a Deposit to book; each clean is charged once it's done.",
    ],
  },
  when: {
    title: "Who it's for",
    text: [
      "Offices, medical and dental practices, shops, studios and other business premises across Queens, Brooklyn, Manhattan and Long Island.",
      "Most businesses have us on set days every week, in the evening or early in the morning, so the place is clean when the team arrives. A one-off clean, before an opening or after a refit, is fine too. Tell us about anything that needs care, like equipment or a server room, and we'll plan around it.",
    ],
  },
  faqs: [
    {
      question: "What happens at the Site Visit?",
      answer:
        "We come to see the space: its size, its rooms and what's in them, and anything that needs care. It's free, and it's how your Quote gets priced for what's really there.",
    },
    {
      question: "Can you clean after hours?",
      answer:
        "Yes. Choose your preferred start time when you request a Quote, in the evening or early in the morning, and tell us how we get in.",
    },
    {
      question: "How often can you come?",
      answer:
        "As often as you need: on whichever days of the week you choose, every week, or for a one-off clean.",
    },
    {
      question: "Do you clean medical and dental offices?",
      answer:
        "Yes. Choose Medical as the type of premises when you request a Quote, and tell us about anything that needs particular care.",
    },
    {
      question: "Do we need to be there?",
      answer:
        "No. Tell us how we get in, whether that's a key, a code or the building's security desk, and we'll lock up when we're done.",
    },
    {
      question: "Can we change the days later?",
      answer:
        "Yes. Ask us for a new Quote with the days you'd like, and from when, and we'll carry on from then on the new days.",
    },
    {
      question: "Do you clean offices in shared buildings?",
      answer:
        "Yes. Tell us about the building's rules in the note, like a service entrance or a certificate of insurance for management, and we'll arrange it before the first clean.",
    },
  ],
  related: ["disinfecting", "post-construction-cleaning", "recurring-cleaning"],
};
