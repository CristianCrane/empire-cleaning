import type { AreaTours } from "../tours.ts";

// The Client portal's first-time help (#294): its tours, the first one a
// person meets led by the value line (its wording is with Jennifer, #206)
export const clientTours = {
  welcome: "Book, move and pay for your cleans here, no phone calls needed.",
  tours: [
    {
      id: "portal-home-quote",
      route: "/portal/",
      steps: [
        {
          target: { press: "See your quote" },
          title: "Your quote",
          text: "Open it to choose your clean and book. You only pay the deposit today.",
        },
      ],
    },
    {
      id: "portal-quote",
      route: "/portal/quotes/$quoteId",
      // a one-off Quote with a Deposit, as the words say: a Service Plan's
      // Quote is "Pay and start your plan", and one with no Deposit "Book"
      steps: [
        {
          target: { named: "Pay and book" },
          title: "Pay and book",
          text: "Pick the clean you want, then pay the deposit to book it. The rest is charged once the clean is done.",
        },
      ],
    },
    {
      id: "portal-home-booked",
      route: "/portal/",
      steps: [
        {
          target: { press: "How we get in" },
          title: "How we get in",
          text: "Tell the crew how to get in: gate codes, keys, pets.",
        },
        {
          // Move or cancel, or Move or skip for a clean on a Service Plan
          target: { press: "Move or" },
          title: "Need another time?",
          text: "Move your clean from here.",
        },
      ],
    },
  ],
} satisfies AreaTours;
