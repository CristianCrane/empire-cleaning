import { billEmail } from "../src/features/bills/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { client, jobId } from "./samples.ts";

export default preview(
  billEmail({
    name: client.name,
    bill: {
      id: jobId,
      number: "EC-000012",
      weekStart: "2026-01-05",
      dueOn: "2026-01-26",
      payment: "on_page",
      status: "due",
      unpaid: false,
      paidVia: null,
      voidReason: null,
      totalCents: 64800,
      taxCents: 5351,
      lines: [
        { label: "Commercial clean, Monday, January 5", amountCents: 32400 },
        { label: "Commercial clean, Thursday, January 8", amountCents: 32400 },
      ],
    },
    occasion: "made",
    card: "Visa ending 4242",
    today: "2026-01-12",
    billedWeekly: true,
    creditRefundDays: 30,
  }),
);
