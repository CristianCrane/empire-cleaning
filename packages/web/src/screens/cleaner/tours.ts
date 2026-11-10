import { catalog } from "@empire-cleaning/models";
import { labels } from "../labels.ts";
import type { AreaTours } from "../tours.ts";
import { cleanerWords } from "./words.ts";

// The Cleaner's first-time help (#296): its tours, the first one a person
// meets led by the value line, in each language (#305), tú in Spanish. A
// step's target is the screen's own word, from cleanerWords or the shared
// labels, so the two can't drift apart
const toursIn = (
  w: (typeof cleanerWords)["en"] & (typeof labels)["en"],
  t: (typeof words)["en"],
): AreaTours => ({
  welcomeTitle: w.welcome,
  welcome: t.welcome,
  tours: [
    {
      id: "cleaner-home",
      route: "/cleaner/",
      // a next Job, not a Site Visit, which has no Open job; one already
      // started is "Now", so it waits for the next
      steps: [
        {
          target: { named: w.nextUp },
          title: t.nextTitle,
          text: t.nextText,
        },
        {
          target: { press: w.openJob },
          title: t.openTitle,
          text: t.openText,
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
          target: { named: w.canYouTakeIt },
          title: t.takeTitle,
          text: t.takeText,
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
          target: { named: w.offeredToYou },
          title: w.offeredToYou,
          text: t.offeredText,
        },
      ],
    },
    {
      id: "cleaner-job",
      route: "/cleaner/jobs/$jobId",
      // once it's started: Couldn't get in from then, Mark done once its
      // whole crew has confirmed too
      steps: [
        {
          target: { press: w.markDone },
          title: t.doneTitle,
          text: t.doneText,
        },
        {
          target: { press: w.jobStatus.no_access },
          title: w.couldntGetIn,
          text: t.getInText,
        },
      ],
    },
  ],
});

const words = catalog({
  en: {
    welcome: "Pick up work and find everything about each job in one place.",
    nextTitle: "Your next job",
    nextText: "When and where, with directions.",
    openTitle: "Open it",
    openText:
      "How to get in, the crew and the client's phone are on the job's page.",
    takeTitle: "Take a job",
    takeText:
      "Confirm to take it. The first cleaner to confirm gets it. Not for me takes it off your list.",
    offeredText: "Confirm it, or say Not for me and it goes to someone else.",
    doneTitle: "When you're done",
    doneText: "Mark it done and say how the home was.",
    getInText: "Say so here. We tell the client and the office.",
  },
  es: {
    welcome: "Toma trabajos y encuentra todo sobre cada uno en un solo lugar.",
    nextTitle: "Tu próximo trabajo",
    nextText: "Cuándo y dónde, con cómo llegar.",
    openTitle: "Ábrelo",
    openText:
      "Cómo entrar, el equipo y el teléfono del cliente están en la página del trabajo.",
    takeTitle: "Toma un trabajo",
    takeText:
      "Confírmalo para tomarlo. Se lo queda el primer limpiador que lo confirme. No es para mí lo quita de tu lista.",
    offeredText: "Confírmalo, o di No es para mí y pasa a otra persona.",
    doneTitle: "Cuando termines",
    doneText: "Márcalo como terminado y di cómo estaba la casa.",
    getInText: "Dilo aquí. Les avisamos al cliente y a la oficina.",
  },
});

export const cleanerTours = {
  en: toursIn({ ...cleanerWords.en, ...labels.en }, words.en),
  es: toursIn({ ...cleanerWords.es, ...labels.es }, words.es),
};
