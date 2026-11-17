import {
  CANCELLATION_CUTOFF_HOURS as CUTOFF,
  catalog,
  LATE_RESCHEDULE_HOURS as LATE,
} from "@empire-cleaning/models";
import { faqs as faqsEs } from "./faqs.es.ts";
import type { Page } from "./routes.ts";

// a question and its answer, which can end with a link to more (a guide)
export type Faq = {
  question: string;
  answer: string;
  more?: { page: Page; text: string };
};

// the home page's questions (#180): only those everyone asks, whatever
// they need cleaned; a service's or an area's own are on its page. The
// owner edits them here, and their Spanish in faqs.es.ts
// asked on the home page and every area's; the area pages take it from here
export const speakSpanish: Faq = {
  question: "Do you speak Spanish?",
  answer:
    "Sí. Our crew speaks English and Spanish, so you can talk to us in whichever you prefer.",
};

// how the deposit works, asked on the home page and answered the same in
// the Terms of service (src/legal/terms.ts)
export const deposit: Faq = {
  question: "How does the deposit work?",
  answer:
    "To book, you accept your quote online and pay a deposit. The rest is charged once the clean is done. A cleaning plan holds one deposit for its whole life, which goes towards its last visit.",
};

// when moving or cancelling a clean is free, as the home page's answer and
// the Terms of service say it
export const moveOrCancel = `Moving or cancelling ${LATE} hours or more before is free. Moving it within ${LATE} hours is free once per clean; cancelling within ${CUTOFF} hours keeps the deposit as a fee.`;

export const faqs = catalog<Faq[]>({
  en: [
    {
      question: "How much does a clean cost?",
      answer:
        "Every home gets its own quote, worked out from the clean you choose, the bedrooms and bathrooms, how many floors, any pets or extras, and how much cleaning it needs. Request one and we'll email it to you, usually within a working day.",
      more: {
        page: { kind: "guide", guide: "cost" },
        text: "What affects the price",
      },
    },
    {
      question: "Do I need to be home while you clean?",
      answer:
        "No. Many of our clients are at work. Tell us how we get in, whether that's a key, a lockbox, a code or the doorman, and we'll lock up when we're done.",
    },
    {
      question: "Is it all right if I have pets?",
      answer:
        "Of course. Say so when you request a quote, so it's in the time we allow and the crew knows who they'll meet at the door.",
    },
    deposit,
    {
      question: "Can I move or cancel a clean?",
      answer: `Yes, from your account. ${moveOrCancel}`,
    },
    {
      question: "Where do you clean?",
      answer:
        "Queens, Brooklyn, Manhattan, all of Nassau County and western Suffolk County, in homes and business premises alike.",
    },
    speakSpanish,
  ],
  es: faqsEs,
});
