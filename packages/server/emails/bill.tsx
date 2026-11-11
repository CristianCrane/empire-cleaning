import { billEmail } from "../src/features/bills/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, lang } from "./samples.ts";

// a line for each thing a Bill can bill
const line = {
  corrected: false,
  fee: null,
  change: null,
  clean,
  creditFrom: null,
};

export default preview(
  billEmail(lang, {
    name: client.name,
    bill: {
      id: jobId,
      number: "EC-000012",
      weekStart: "2026-01-05",
      dueOn: "2026-01-26",
      payment: "on_page",
      status: "due",
      unpaid: null,
      paidVia: null,
      voidReason: null,
      totalCents: 64800,
      taxCents: 5351,
      lines: [
        { ...line, key: "price", amountCents: 32400 },
        {
          ...line,
          key: "adjustment:1",
          change: {
            kind: "add_on_done",
            addOn: { name: "Inside the oven", nameEs: "Dentro del horno" },
            hours: null,
          },
          amountCents: 3000,
        },
        { ...line, key: "deposit", amountCents: -8100 },
        { ...line, key: "fee", fee: "cancelled", amountCents: 4000 },
        { ...line, key: "price", corrected: true, amountCents: -2000 },
        {
          ...line,
          key: "credit",
          clean: null,
          creditFrom: "EC-000011",
          amountCents: -1000,
        },
      ],
    },
    occasion: "made",
    card: { brand: "Visa", last4: "4242" },
    today: "2026-01-12",
    billedWeekly: true,
    creditRefundDays: 30,
  }),
);
