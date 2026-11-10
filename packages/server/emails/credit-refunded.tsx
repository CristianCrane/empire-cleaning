import { creditRefundedEmail } from "../src/features/bills/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { client, jobId, lang } from "./samples.ts";

export default preview(
  creditRefundedEmail(lang, {
    name: client.name,
    billId: jobId,
    number: "EC-000012",
    cents: 3240,
    creditRefundDays: 30,
  }),
);
