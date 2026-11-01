import type { ServicePage } from "./index.ts";
import { officeServices } from "./shared.ts";

export const recurringCleaning: ServicePage = {
  slug: "recurring-cleaning",
  card: "Recurring service",
  // asked for as a Standard Clean with regular visits
  office: { ...officeServices.standard, regular: true },
  title: "Recurring Cleaning in Queens, NYC & Long Island",
  description:
    "Weekly, every-two-weeks or every-four-weeks house cleaning in Queens, Brooklyn, Manhattan and Long Island, 10% off every visit. Skip or end any time. Request a Quote.",
  heading: "Weekly, bi-weekly or monthly cleaning",
  intro:
    "A Service Plan keeps your home clean without you having to think about it: the same day, the same time, every week, two weeks or four. And every visit is 10% off.",
  included: {
    title: "What each visit includes",
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
        name: "Every room",
        items: [
          "Surfaces and furniture dusted",
          "Light switches and door handles wiped",
          "Floors vacuumed and mopped",
          "Trash emptied",
        ],
      },
    ],
    note: "Each visit is a standard clean. Want a deep clean now and then, or an Add-on like inside the fridge? Ask for it as a one-off Quote any time; your plan carries on.",
  },
  pricing: {
    title: "How a Service Plan is priced",
    text: [
      "Each visit is priced from your home, as any Quote is: the rooms, the floors, pets, and how much cleaning it needs. Then 10% comes off every visit for as long as the plan runs.",
      "A plan holds one Deposit for its whole life, not one per visit. Each visit is charged once it's done, and when the plan ends, the Deposit goes towards the last one.",
    ],
  },
  when: {
    title: "How it starts",
    text: [
      "Every plan starts with a first clean, booked on its own. It's how you see how we work, and how we check your home is as described before we commit to regular visits. We recommend a deep clean for it.",
      "After it, we send you a Quote for the plan: the day or days you'd like, weekly, every two weeks or every four weeks. Accept it and the visits are booked. Skip one when you're away, or end the plan whenever you need to.",
    ],
  },
  faqs: [
    {
      question: "Why do I need a first clean before the plan?",
      answer:
        "So you can see how we work before committing, and we can see your home is as described. A deep clean is best, since it brings everything up to the standard each visit then keeps.",
    },
    {
      question: "Can I skip a visit?",
      answer:
        "Yes. Cancel that visit ahead of time and the plan carries on as usual. A cancellation at the last minute has a fee, as any clean does.",
    },
    {
      question: "Can I have more than one visit a week?",
      answer:
        "Yes. A plan can visit on several days every week, each at its own time.",
    },
    {
      question: "Can I end the plan?",
      answer:
        "Whenever you need to. The plan's Deposit goes towards its last visit.",
    },
    {
      question: "Can I change the day?",
      answer:
        "Yes. Ask for a new plan Quote with the day you'd like; once you accept it, the plan carries on from then on the new day.",
    },
    {
      question: "What if I need an extra clean before a party?",
      answer:
        "Ask for a one-off Quote any time, a deep clean or a standard one. Having a plan never stops you booking an extra visit.",
    },
    {
      question: "Can I add extras to a visit?",
      answer:
        "Yes. Ask for a one-off Quote for the extra, or for a new plan Quote if you'd like it done at every visit from then on.",
    },
  ],
  related: ["standard-cleaning", "deep-cleaning", "office-cleaning"],
};
