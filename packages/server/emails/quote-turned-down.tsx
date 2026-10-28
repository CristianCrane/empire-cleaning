import { turnDownEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId } from "./samples.ts";

export default preview(
  turnDownEmail({
    name: client.name,
    address,
    quoteId: jobId,
    why: "it's outside the area we clean",
  }),
);
