import type { AreaTours } from "../tours.ts";

// The Office's first-time help (#295): its tours, the first one a person
// meets led by the value line
export const officeTours = {
  welcomeTitle: "Welcome",
  welcome: "Every request, clean and payment, and what needs you today.",
  tours: [
    {
      id: "office-today",
      route: "/office/",
      steps: [
        {
          // the Section: first in the page, before its tiles ("Needs
          // attention by kind") and its list, also "Needs attention"
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
          title: "The schedule",
          text: "Every clean and site visit, day by day. Move them there.",
        },
      ],
    },
    {
      id: "office-quote-draft",
      route: "/office/quotes/$quoteId/draft",
      // a one-off Quote's, whose part "Service" holds the way to set each
      // price yourself (the prices are beside it): a Service Plan's Draft
      // sets them in each weekday instead (its Plan's Service picker isn't
      // a named part)
      steps: [
        {
          target: { named: "Service" },
          title: "Price it",
          text: "Prices are worked out for this home from your prices. Set one yourself if it needs to be different, and say why.",
        },
        {
          target: { press: "Send to" },
          title: "Send it",
          text: "Pick a time, then send it. The client gets an email with a link to accept it and book.",
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
          text: "Someone asked to move this job. Confirm the new time, or turn it down and say why. We hold the time until you answer.",
        },
      ],
    },
    {
      id: "office-job-cleaner-needed",
      route: "/office/jobs/$jobId",
      steps: [
        {
          target: { press: "Offer to a cleaner" },
          title: "Needs a cleaner",
          text: "From a week before, any free cleaner can take it. Or offer it to someone yourself from here.",
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
          title: "Your schedule",
          text: "Every clean and site visit, day by day. Open a job to see it or move it. On a computer, drag it to a new time.",
        },
      ],
    },
  ],
} satisfies AreaTours;
