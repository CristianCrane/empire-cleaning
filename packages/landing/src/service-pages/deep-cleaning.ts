import type { ServicePage } from "./index.ts";
import { addOnsNote, officeServices } from "./shared.ts";

export const deepCleaning: ServicePage = {
  slug: "deep-cleaning",
  card: "Residential deep cleaning",
  office: officeServices.deep,
  title: "Deep Cleaning in Queens, NYC & Long Island",
  description:
    "A top-to-bottom deep clean of your home in Queens, Brooklyn, Manhattan or Long Island: every room, behind the appliances, along every baseboard. Request a Quote.",
  heading: "Deep cleaning, top to bottom",
  intro:
    "A deep clean reaches everything a regular clean doesn't get to every time: the baseboards, the vents, behind the appliances, the grout. It's the clean we recommend for our first visit to any home.",
  included: {
    title: "What a deep clean includes",
    rooms: [
      {
        name: "Kitchen",
        items: [
          "Counters, backsplash and sink scrubbed",
          "Stovetop and range hood degreased",
          "Outside of every appliance, cabinet and drawer wiped",
          "Behind and under appliances we can safely move",
          "Floor washed edge to edge",
        ],
      },
      {
        name: "Bathrooms",
        items: [
          "Shower, tub and tiles scrubbed and descaled",
          "Grout scrubbed",
          "Toilet cleaned inside, outside and behind",
          "Sinks, faucets and mirrors polished",
          "Floor washed edge to edge",
        ],
      },
      {
        name: "Bedrooms and living areas",
        items: [
          "Dusting high and low: ceiling fans, light fixtures, vents, shelves",
          "Window sills and tracks",
          "Under the beds and sofas, where we can reach",
          "Floors vacuumed and mopped",
        ],
      },
      {
        name: "Throughout",
        items: [
          "Baseboards, doors and door frames wiped",
          "Light switches, handles and railings wiped",
          "Trash emptied",
        ],
      },
    ],
    note: addOnsNote,
  },
  pricing: {
    title: "How a deep clean is priced",
    text: [
      "Every home is different, so we don't publish a price. Your Quote is worked out from your home: the bedrooms and bathrooms, how many floors, whether there are pets, any Add-ons, and how much cleaning it needs (light, moderate or heavy).",
      "A deep clean takes longer than a standard clean, and your Quote says how long we'll be there. To book, you accept the Quote online and pay a Deposit; the rest is charged once the clean is done.",
    ],
  },
  when: {
    title: "When to book a deep clean",
    text: [
      "As a first clean, before regular visits begin: it brings the whole home up to a standard that a regular clean then keeps. It's also the one to book before guests arrive, after the holidays, at the change of seasons, or when the home has simply got away from you.",
      "Moving in or out? An empty home has its own clean: see move-in and move-out cleaning.",
    ],
  },
  faqs: [
    {
      question:
        "What's the difference between a deep clean and a standard clean?",
      answer:
        "A standard clean keeps a clean home clean: surfaces, kitchen, bathrooms and floors. A deep clean goes further, to the baseboards, vents, grout, light fixtures and behind the appliances, and takes longer.",
    },
    {
      question: "Do I need a deep clean before regular visits?",
      answer:
        "We recommend one. It lets us bring everything up to standard once, so each regular visit after it keeps it there. You can choose a standard clean for your first visit instead.",
    },
    {
      question: "Is inside the oven and fridge included?",
      answer:
        "They're Add-ons, along with inside the cabinets and interior windows. Tick the ones you want when you request a Quote and they'll be priced in.",
    },
    {
      question: "Do I need to be home?",
      answer:
        "No. Tell us how we get in, whether that's a key, a lockbox or the doorman, and we'll lock up when we're done.",
    },
    {
      question: "Is it all right if I have pets?",
      answer:
        "Of course. Say so when you request a Quote, so it's in the time we allow and the crew knows who they'll meet.",
    },
  ],
  related: [
    "standard-cleaning",
    "recurring-cleaning",
    "move-in-move-out-cleaning",
  ],
};
