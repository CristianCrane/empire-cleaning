import { cleanersNeededEmail } from "../src/features/assignments/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { cleaner, jobId, monday, wednesday, lang } from "./samples.ts";

export default preview(
  cleanersNeededEmail(lang, {
    name: cleaner,
    soon: false,
    jobs: [
      {
        jobId,
        startsAt: monday.toISOString(),
        service: { name: "Deep Clean", nameEs: "Limpieza profunda" },
        hoursOnSite: 3,
        crewSize: 2,
        postcode: "11375",
      },
      {
        jobId,
        startsAt: wednesday.toISOString(),
        service: { name: "Standard Clean", nameEs: "Limpieza estándar" },
        hoursOnSite: 2,
        crewSize: 1,
        postcode: "11374",
      },
    ],
  }),
);
