import type { ServicePage } from "./index.ts";

export const disinfecting: ServicePage = {
  slug: "disinfecting",
  card: "Disinfecting",
  // the Office has no Disinfecting Service: the copy says to choose a clean
  // and ask for disinfecting in the note
  title: "Disinfecting in Queens, NYC & Long Island",
  description:
    "Disinfecting of high-touch surfaces and shared spaces in homes and businesses across Queens, Brooklyn, Manhattan and Long Island. Request a Quote.",
  heading: "Disinfecting homes and workplaces",
  intro:
    "The handles, switches and counters everyone touches, disinfected as well as cleaned: at home after someone's been ill, or in a shared workplace all through the year.",
  included: {
    title: "What we disinfect",
    rooms: [
      {
        name: "High-touch surfaces",
        items: [
          "Door handles, knobs and push plates",
          "Light switches and railings",
          "Faucets and toilet flush handles",
          "Remote controls, phones and keyboards, where you'd like",
        ],
      },
      {
        name: "Kitchens and bathrooms",
        items: [
          "Counters, tables and sinks",
          "Appliance handles",
          "Toilets, sinks, tubs and showers",
        ],
      },
      {
        name: "Shared spaces",
        items: [
          "Reception desks and waiting areas",
          "Break rooms and meeting rooms",
          "Chair arms and table tops",
        ],
      },
    ],
    note: "We clean a surface before we disinfect it: a disinfectant only works properly on a clean surface.",
  },
  pricing: {
    title: "How it's priced",
    text: [
      "Disinfecting is part of a clean. In your Quote Request, choose the clean you need (a Standard or Deep Clean for a home, Commercial cleaning for business premises) and tell us in the note you'd like disinfecting, and of what. If you'd like it done at every visit, say so and we'll include it in each one.",
      "Your Quote says what it covers and how long we'll be there. Accept it online and pay a Deposit to book; the rest is charged once the clean is done.",
    ],
  },
  when: {
    title: "When to book it",
    text: [
      "At home: after someone in the house has been ill, before a new baby or an older relative comes home, or through the cold and flu season. Ahead of a party or the holidays, too, when more people than usual will be through the door.",
      "At work: anywhere many people share the same surfaces, like offices, practices, shops and studios, as part of their regular cleaning or as a one-off.",
    ],
  },
  faqs: [
    {
      question: "Which Service do I choose in the form?",
      answer:
        "The clean you need: Standard or Deep Clean for a home, Commercial cleaning for business premises. Then say in the note you'd like disinfecting, and anything in particular.",
    },
    {
      question: "Is it a separate visit?",
      answer:
        "It doesn't need to be. Disinfecting is done as part of a clean, so we clean each surface first and then disinfect it.",
    },
    {
      question: "I have children and pets. Is that a problem?",
      answer:
        "Not at all. Tell us about them when you request a Quote, so we can plan around them.",
    },
    {
      question: "Can you disinfect our office regularly?",
      answer:
        "Yes. Ask for it as part of your office's regular cleaning, on the days you choose.",
    },
    {
      question: "Can you disinfect after someone has been ill?",
      answer:
        "Yes. Tell us in the note, and which rooms they used most, so we start there.",
    },
    {
      question: "How long does it take?",
      answer:
        "It depends on how much there is to disinfect. Your Quote says how long we'll be there.",
    },
    {
      question: "Do I need to be home?",
      answer: "No. Tell us how we get in and we'll lock up when we're done.",
    },
    {
      question: "Do you disinfect gyms and studios?",
      answer:
        "Yes, as business premises: choose Commercial cleaning and tell us about the equipment in the note.",
    },
    {
      question: "Can you disinfect a home before we move in?",
      answer:
        "Yes. Choose Move-in/out Clean when you request a Quote, and say in the note you'd like it disinfected too.",
    },
  ],
  related: ["office-cleaning", "standard-cleaning", "deep-cleaning"],
};
