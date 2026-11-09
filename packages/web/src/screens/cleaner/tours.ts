import type { AreaTours } from "../tours.ts";

// The Cleaner's first-time help (#296): its tours, the first one a person
// meets led by the value line
export const cleanerTours = {
  welcome: "Pick up work and find everything about each job in one place.",
  tours: [
    {
      id: "cleaner-home",
      route: "/cleaner/",
      // a next Job, not a Site Visit, which has no Open job; one already
      // started is "Now", so it waits for the next
      steps: [
        {
          target: { named: "Next up" },
          title: "Your next job",
          text: "When and where, with directions.",
        },
        {
          target: { press: "Open job" },
          title: "Open it",
          text: "How to get in, the crew and the client's phone are on the job's page.",
        },
      ],
    },
    // taking a Job, on the page each Offer opens: the Offers list has
    // nothing to press, and its Open to you is there even when empty
    {
      id: "cleaner-open",
      route: "/cleaner/open/$jobId",
      steps: [
        {
          target: { named: "Can you take it?" },
          title: "Take a job",
          text: "Confirm to take it. The first cleaner to confirm gets it. Not for me takes it off your list.",
        },
      ],
    },
    // a Job's two, apart: one offered to them has no Mark done yet, and a
    // tour runs only once each of its steps is on the screen
    {
      id: "cleaner-job-offered",
      route: "/cleaner/jobs/$jobId",
      steps: [
        {
          target: { named: "Offered to you" },
          title: "Offered to you",
          text: "Confirm it, or say Not for me and it goes to someone else.",
        },
      ],
    },
    {
      id: "cleaner-job",
      route: "/cleaner/jobs/$jobId",
      // both from the Job's start
      steps: [
        {
          target: { press: "Mark done" },
          title: "When you're done",
          text: "Mark it done and say how the home was.",
        },
        {
          target: { press: "Couldn't get in" },
          title: "Couldn't get in?",
          text: "Say so here. We tell the client and the office.",
        },
      ],
    },
  ],
} satisfies AreaTours;
