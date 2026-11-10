import { quoteReceivedEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId } from "./samples.ts";

// the receipt to a Client whose Preferred Language is Spanish (ADR-0025)
export default preview(
  quoteReceivedEmail("es", { ...client, address, quoteId: jobId }),
);
