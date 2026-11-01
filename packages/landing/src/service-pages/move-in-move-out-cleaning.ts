import type { ServicePage } from "./index.ts";
import { addOnsNote, officeServices } from "./shared.ts";

export const moveInMoveOut: ServicePage = {
  slug: "move-in-move-out-cleaning",
  card: "Move-in and move-out",
  office: officeServices.move,
  title: "Move-Out Cleaning in Queens, NYC & Long Island",
  description:
    "Move-out and move-in cleaning in Queens, Brooklyn, Manhattan and Long Island: an empty home cleaned for the walk-through or your first night. Request a Quote.",
  heading: "Move-in and move-out cleaning",
  intro:
    "An empty home, cleaned from the closets to the floors: ready for the landlord's walk-through, the new owners, or your own first night in.",
  included: {
    title: "What a move-in or move-out clean includes",
    rooms: [
      {
        name: "Kitchen",
        items: [
          "Counters, backsplash and sink scrubbed",
          "Stovetop and range hood degreased",
          "Outside of every appliance and cabinet wiped",
          "Behind and under appliances we can safely move",
          "Floor washed edge to edge",
        ],
      },
      {
        name: "Bathrooms",
        items: [
          "Shower, tub, tiles and grout scrubbed",
          "Toilet cleaned inside, outside and behind",
          "Sinks, faucets, mirrors and medicine cabinet cleaned",
          "Floor washed edge to edge",
        ],
      },
      {
        name: "Every room",
        items: [
          "Closets and shelves wiped out",
          "Baseboards, doors and door frames wiped",
          "Window sills and tracks",
          "Light fixtures, switches and outlets wiped",
          "Floors vacuumed and mopped",
        ],
      },
    ],
    note: addOnsNote,
  },
  pricing: {
    title: "How it's priced",
    text: [
      "Your Quote is worked out from the home: the bedrooms and bathrooms, how many floors, any Add-ons, and how much cleaning it needs. A home after a long tenancy usually needs more than one that was kept up.",
      "It's priced like a deep clean, because it is one, with the home empty. Your Quote says how long we'll be there; accept it online and pay a Deposit to book, and the rest is charged once the clean is done.",
    ],
  },
  when: {
    title: "When to book it",
    text: [
      "Moving out: once your things are out and before you hand back the keys. Many leases ask for the home back broom-clean or better, and a clean empty home makes the final walk-through easier.",
      "Moving in: before your furniture arrives, so every cabinet, closet and corner is clean before anything goes into it. Landlords and agents book us between tenants too: ask for a Quote for each unit.",
    ],
  },
  faqs: [
    {
      question: "Does the home need to be empty?",
      answer:
        "Yes, or as near as possible. We clean inside the closets, along the baseboards and in every corner, and furniture and boxes get in the way.",
    },
    {
      question: "Will it get my security deposit back?",
      answer:
        "We can't promise what a landlord decides, but we clean what they check: the kitchen, the bathrooms, the floors, inside the closets. Tell us about anything in your lease when you request a Quote.",
    },
    {
      question: "Can you clean on the day I move out?",
      answer:
        "Usually. The end of the month books up first, so request a Quote as soon as you know your date.",
    },
    {
      question: "Is inside the fridge and oven included?",
      answer:
        "They're Add-ons, along with inside the cabinets and interior windows. Tick them when you request a Quote, as most people moving do.",
    },
    {
      question: "I'm a landlord. Can you clean between tenants?",
      answer: "Yes. Request a Quote for each unit, and tell us how we get in.",
    },
    {
      question: "How long does it take?",
      answer:
        "It depends on the size of the home and how much cleaning it needs. Your Quote says how long we'll be there, so you can plan the move around it.",
    },
  ],
  related: ["deep-cleaning", "post-construction-cleaning", "standard-cleaning"],
};
