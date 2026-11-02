import { quoteRequestedEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId } from "./samples.ts";

export default preview(
  quoteRequestedEmail({
    client: client.name,
    businessName: null,
    serviceName: "Deep Clean",
    regular: true,
    address,
    quoteId: jobId,
  }),
);
