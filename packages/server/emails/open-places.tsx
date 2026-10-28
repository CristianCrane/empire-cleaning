import { openPlacesEmail } from "../src/features/assignments/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { cleaner, jobId, monday, wednesday } from "./samples.ts";

export default preview(
  openPlacesEmail({
    name: cleaner,
    soon: false,
    places: [
      {
        jobId,
        startsAt: monday.toISOString(),
        serviceName: "Deep Clean",
        hoursOnSite: 3,
        crewSize: 2,
        postcode: "11375",
      },
      {
        jobId,
        startsAt: wednesday.toISOString(),
        serviceName: "Standard Clean",
        hoursOnSite: 2,
        crewSize: 1,
        postcode: "11374",
      },
    ],
  }),
);
