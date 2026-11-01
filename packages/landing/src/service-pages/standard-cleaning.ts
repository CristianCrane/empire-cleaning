import type { ServicePage } from "./index.ts";
import { addOnsNote, officeServices } from "./shared.ts";

export const standardCleaning: ServicePage = {
  slug: "standard-cleaning",
  card: "Standard cleaning",
  office: officeServices.standard,
  title: "Standard House Cleaning in Queens & Long Island",
  description:
    "Standard house cleaning in Queens, Brooklyn, Manhattan and Long Island: kitchen, bathrooms, dusting and floors, done properly. Se habla español. Request a Quote.",
  heading: "Standard house cleaning",
  intro:
    "The clean that keeps a clean home feeling that way: the kitchen, the bathrooms, the dusting and the floors, done properly every time.",
  included: {
    title: "What a standard clean includes",
    rooms: [
      {
        name: "Kitchen",
        items: [
          "Counters, sink and backsplash cleaned",
          "Stovetop wiped",
          "Outside of the appliances and cabinet fronts wiped",
          "Floor vacuumed and mopped",
        ],
      },
      {
        name: "Bathrooms",
        items: [
          "Shower, tub and tiles cleaned",
          "Toilet cleaned inside and out",
          "Sinks, faucets and mirrors shined",
          "Floor mopped",
        ],
      },
      {
        name: "Bedrooms and living areas",
        items: [
          "Surfaces and furniture dusted",
          "Mirrors and glass tables shined",
          "Floors vacuumed and mopped",
        ],
      },
      {
        name: "Throughout",
        items: ["Light switches and door handles wiped", "Trash emptied"],
      },
    ],
    note: `Baseboards, vents, grout and behind the appliances are part of a deep clean. ${addOnsNote}`,
  },
  pricing: {
    title: "How a standard clean is priced",
    text: [
      "We don't publish a price, because no two homes are the same. Your Quote is worked out from your home: the bedrooms and bathrooms, how many floors, any pets, any Add-ons, and how much cleaning it needs (light, moderate or heavy).",
      "Your Quote says how long we'll be there. You accept it online and pay a Deposit to book; the rest is charged once the clean is done.",
    ],
  },
  when: {
    title: "Who it's for",
    text: [
      "Homes that are already in good shape and need keeping that way: between deep cleans, before the weekend, or every week or two as part of a Service Plan, where every visit is 10% off.",
      "For a first visit we recommend a deep clean, so everything starts from the same standard. If your home was cleaned properly recently, a standard clean is fine to start with.",
    ],
  },
  faqs: [
    {
      question: "Can I start with a standard clean?",
      answer:
        "Yes. Your Quote will also offer a deep clean for your first visit, since we recommend one, but you choose which to book.",
    },
    {
      question: "How do I get a standard clean every week or two?",
      answer:
        "With a Service Plan: after your first clean, choose weekly, every two weeks or every four weeks, and every visit is 10% off.",
    },
    {
      question: "How long does a standard clean take?",
      answer:
        "It depends on the size of your home and how much cleaning it needs. Your Quote says how long we'll be there.",
    },
    {
      question: "Do I need to be home?",
      answer: "No. Tell us how we get in and we'll lock up when we're done.",
    },
    {
      question: "Can you focus on certain rooms?",
      answer:
        "Yes. Tell us in the note which rooms matter most, and any you'd like left alone, and the crew will spend their time where you want it.",
    },
    {
      question: "Is it all right if I have pets?",
      answer:
        "Of course. Say so when you request a Quote, so it's in the time we allow and the crew knows who they'll meet.",
    },
    {
      question: "Can I add extras, like inside the fridge?",
      answer:
        "Yes. Inside the fridge, inside the oven, inside the cabinets and interior windows are Add-ons: tick the ones you'd like when you request a Quote, and they're priced in.",
    },
  ],
  related: ["deep-cleaning", "recurring-cleaning", "disinfecting"],
};
