import { siteVisitCancelledEmail } from "../src/features/site-visits/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, monday } from "./samples.ts";

export default preview(
  siteVisitCancelledEmail({ name: client.name, address, startsAt: monday }),
);
