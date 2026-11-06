import type { AreaTours } from "../tours.ts";

// The Office's first-time help (#295): its tours, the first one a person
// meets led by the value line
export const officeTours = {
  welcome: "Every request, clean and payment, and what needs you today.",
  tours: [
    {
      id: "office-today",
      route: "/office/",
      steps: [
        {
          target: { named: "Needs attention" },
          title: "Needs attention",
          text: "Each row is something waiting on you. Open it to deal with it, and it leaves the list once it's done.",
        },
        {
          target: { named: "Needs attention by kind" },
          title: "Jobs, Quotes and Money",
          text: "Press one to see only those, and again to see everything.",
        },
        {
          // in the navigation: Today has no link of its own to it
          target: { press: "Schedule" },
          title: "The Schedule",
          text: "Every clean and Site Visit, day by day. Move them there.",
        },
      ],
    },
    {
      id: "office-quote-draft",
      route: "/office/quotes/$quoteId/draft",
      // a one-off Quote's: a Service Plan's Draft is priced by its Plan and
      // each week instead
      steps: [
        {
          target: { named: "Service and prices" },
          title: "Price it",
          text: "Prices are worked out from the Price List for this home. Override one if it needs to be different, with a reason.",
        },
        {
          target: { press: "Send to" },
          title: "Send it",
          text: "Pick a time, then send it. The Client is emailed a link to accept it and book.",
        },
      ],
    },
    // a Job's two, apart: a Job seldom has both at once, and a tour runs
    // only once each of its steps is on the screen
    {
      id: "office-job-new-time",
      route: "/office/jobs/$jobId",
      steps: [
        {
          target: { press: "Answer" },
          title: "A new time",
          text: "Someone asked to move this Job. Confirm the new time, or turn it down and say why. It's held until you answer.",
        },
      ],
    },
    {
      id: "office-job-cleaner-needed",
      route: "/office/jobs/$jobId",
      steps: [
        {
          target: { press: "Offer to a Cleaner" },
          title: "Needs a Cleaner",
          text: "From a week before, it's open to every free Cleaner. Offer it to someone yourself from here.",
        },
      ],
    },
    {
      id: "office-schedule",
      route: "/office/schedule",
      steps: [
        {
          // the first day shown
          target: { named: "Jobs on" },
          title: "Your Schedule",
          text: "Every clean and Site Visit, day by day. Open a Job to see it or move it; on a computer, drag it to a new time.",
        },
      ],
    },
  ],
} satisfies AreaTours;
