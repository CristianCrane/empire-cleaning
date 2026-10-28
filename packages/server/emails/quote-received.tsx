import { quoteReceivedEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId } from "./samples.ts";

export default preview(
  quoteReceivedEmail({ ...client, address, quoteId: jobId }),
);
