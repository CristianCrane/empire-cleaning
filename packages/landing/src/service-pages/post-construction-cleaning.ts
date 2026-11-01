import type { ServicePage } from "./index.ts";

export const postConstruction: ServicePage = {
  slug: "post-construction-cleaning",
  card: "Post-construction",
  // the Office has no Post-construction Service: the copy says to choose a
  // Deep Clean or Commercial cleaning and describe the work in the note
  title: "Post-Construction Cleaning in Queens & Long Island",
  description:
    "Post-construction and renovation cleaning in Queens, Brooklyn, Manhattan and Long Island: the fine dust and residue cleared so you can move back in. Request a Quote.",
  heading: "Post-construction cleaning",
  intro:
    "The builders have gone, and the dust hasn't. We clear the fine construction dust and residue from every surface, top to bottom, so you can move back in.",
  included: {
    title: "What a post-construction clean includes",
    rooms: [
      {
        name: "Every room",
        items: [
          "Dust cleared from top to bottom: ceilings' edges, vents, light fixtures, shelves",
          "Walls dusted, and doors, frames and baseboards wiped",
          "Window sills, tracks and frames",
          "Light switches and outlets wiped",
        ],
      },
      {
        name: "Kitchen and bathrooms",
        items: [
          "Cabinets, counters and fixtures wiped of dust and residue",
          "Sinks, tubs, showers and toilets cleaned",
          "Tile and fixtures wiped of construction haze",
        ],
      },
      {
        name: "Floors",
        items: ["Vacuumed, then washed, as many times as the dust needs"],
      },
    ],
    note: "We clear dust and residue, not building debris: the contractors take away rubble, offcuts and leftover materials.",
  },
  pricing: {
    title: "How it's priced",
    text: [
      "Construction dust settles everywhere, so a post-construction clean takes longer than a regular one. In your Quote Request, choose Deep Clean for a home, or Commercial cleaning for business premises, pick Heavy for how much cleaning it needs, and tell us in the note what work was done. Say roughly how big the space is and which rooms were worked on, so the Quote allows enough time.",
      "Your Quote says how long we'll be there. For business premises we visit first, for free, to see the space. Accept the Quote online and pay a Deposit to book; the rest is charged once the clean is done.",
    ],
  },
  when: {
    title: "When to book it",
    text: [
      "Once the work is finished and the trades are out, and before your furniture goes back in: it's much quicker to clean an empty room, and nothing new gets dusty.",
      "We clean after kitchen and bathroom remodels, basement finishes, extensions, gut renovations and new builds, in homes, offices and shops.",
    ],
  },
  faqs: [
    {
      question: "Which Service do I choose in the form?",
      answer:
        "Deep Clean for a home, or Commercial cleaning for business premises. Choose Heavy for how much cleaning it needs, and tell us in the note it's after construction and what was done.",
    },
    {
      question: "When should I book it?",
      answer:
        "Once the work is finished and before your furniture goes back in. If the trades are still coming back for small jobs, book after their last visit.",
    },
    {
      question: "Do you take away debris?",
      answer:
        "No. We clean the dust and residue construction leaves; the contractors take away rubble and leftover materials.",
    },
    {
      question: "Do you clean new offices and shops?",
      answer:
        "Yes. Request a Quote for business premises and we'll visit the space first, for free, to see what it needs.",
    },
    {
      question: "Can you clean while work is still going on?",
      answer:
        "It's best not to: dust keeps settling while the trades work. Book us after their last visit, so the clean lasts.",
    },
    {
      question: "Do you clean the windows?",
      answer:
        "Sills, tracks and frames are part of the clean. For a home, interior windows are an Add-on: tick it in your Quote Request.",
    },
    {
      question: "Do you clean apartments after a renovation?",
      answer:
        "Yes. Tell us about the building's rules in the note, like a service elevator to book or a certificate of insurance for management, and we'll arrange it.",
    },
  ],
  related: ["deep-cleaning", "move-in-move-out-cleaning", "office-cleaning"],
};
