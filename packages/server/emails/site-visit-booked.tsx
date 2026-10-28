import { siteVisitBookedEmail } from "../src/features/site-visits/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, monday } from "./samples.ts";

export default preview(
  siteVisitBookedEmail({
    name: client.name,
    address,
    startsAt: monday,
    visitor: "Olive Owner",
    minutes: 30,
    place: "home",
  }),
);
