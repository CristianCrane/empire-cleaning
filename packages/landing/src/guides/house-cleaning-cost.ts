import type { Guide } from "./index.ts";

const everyService = [
  "deep-cleaning",
  "standard-cleaning",
  "recurring-cleaning",
  "move-in-move-out-cleaning",
  "post-construction-cleaning",
  "office-cleaning",
  "disinfecting",
];

export const houseCleaningCost: Guide = {
  slug: "house-cleaning-cost",
  crumb: "What affects the price",
  title: "House Cleaning Cost in Queens, NYC & Long Island",
  description:
    "What decides the price of a house cleaning in Queens, NYC and Long Island: the clean, the size of the home, its condition, pets, Add-ons and how often.",
  heading: "How much does house cleaning cost?",
  intro:
    "It's the first thing most people ask, and the honest answer is that it depends on your home. Here's what the price depends on, why we quote every home on its own, and how to keep the cost down.",
  published: "2026-11-01",
  sections: [
    {
      title: "Why we don't publish a price",
      text: [
        "A one-bedroom apartment kept tidy and a four-bedroom house after a renovation are not the same job, and a single price for both would be wrong for one of them. A flat rate either charges a small, tidy home for work it doesn't need, or leaves too little time to clean a bigger one properly.",
        "So every home gets its own Quote. Tell us about it in a few minutes, with no account needed, and we'll email you a Quote priced for your home, usually within a working day.",
        "Offices and other business premises are priced differently: from the floor area, the type of premises and how often you'd like us. We visit first, for free, to see the space, then send a Quote.",
      ],
    },
    {
      title: "What the price depends on",
      text: [
        "A Quote is worked out from how long the clean will take, and that comes down to a handful of things:",
      ],
      list: [
        "The clean you choose. A deep clean takes longer than a standard clean; a move-in or move-out clean is a deep clean of an empty home.",
        "The size of the home: the bedrooms, the bathrooms and how many floors.",
        "How much cleaning it needs: light (tidy, with everyday dust), moderate (lived in, with some build-up in the kitchen and bathrooms) or heavy (not cleaned in a while, or after a move, renovation or party).",
        "Pets, whose hair takes time to get up from floors and furniture.",
        "Add-ons: inside the fridge, inside the oven, inside the cabinets and interior windows. You choose only the ones you want.",
      ],
    },
    {
      title: "Deep clean or standard clean?",
      text: [
        "A deep clean reaches what a regular clean doesn't every time: the baseboards, vents, grout and behind the appliances. It costs more because it takes longer.",
        "We recommend one for our first visit to any home, so everything starts from the same standard. After that, a standard clean keeps it there, and costs less each time.",
      ],
    },
    {
      title: "How regular visits change it",
      text: [
        "With a Service Plan, every visit is 10% off: weekly, every two weeks or every four weeks, on the day you choose. A home cleaned regularly also needs less time each visit than one cleaned once in a while.",
        "A plan holds one Deposit for its whole life, not one per visit, and you can skip a visit or end the plan whenever you need to.",
      ],
    },
    {
      title: "What you pay, and when",
      text: [
        "You accept your Quote online and pay a Deposit to book. The rest is charged once the clean is done, so you only pay in full for a clean that's happened.",
        "If the home turns out to need more than the Quote allowed for, the crew asks first, and you approve the price of any extra work before it's done. Moving a clean is free 24 hours or more before it, and once within 24 hours; cancelling within 24 hours keeps the Deposit as a fee.",
      ],
    },
    {
      title: "Keeping the cost down",
      text: ["A few things make every visit go further:"],
      list: [
        "Start with one deep clean, then keep it up with standard visits on a Service Plan, 10% off each.",
        "Clear away clutter before we arrive, so our time goes on cleaning rather than tidying.",
        "Choose only the Add-ons you need, when you need them.",
        "Describe your home as it is. An accurate Quote means no surprises on the day.",
      ],
    },
  ],
  linkedFrom: everyService.map((service) => ({
    service,
    under: "pricing" as const,
    text: "More on what affects the price",
  })),
};
