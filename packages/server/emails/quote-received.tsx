import { quoteReceivedEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId, lang } from "./samples.ts";

export default preview(
  quoteReceivedEmail(lang, { ...client, address, quoteId: jobId }),
);
