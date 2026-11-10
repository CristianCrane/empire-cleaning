import { siteVisitCancelledEmail } from "../src/features/site-visits/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, lang, monday } from "./samples.ts";

export default preview(
  siteVisitCancelledEmail(lang, {
    name: client.name,
    address,
    startsAt: monday,
  }),
);
