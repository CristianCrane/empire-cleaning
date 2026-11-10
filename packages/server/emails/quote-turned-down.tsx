import { turnDownEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId, lang } from "./samples.ts";

export default preview(
  turnDownEmail(lang, {
    name: client.name,
    address,
    quoteId: jobId,
    reason: "out_of_area",
  }),
);
