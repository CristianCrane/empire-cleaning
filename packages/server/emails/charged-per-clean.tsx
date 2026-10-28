import { chargedPerCleanEmail } from "../src/features/bills/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { client, settled } from "./samples.ts";

export default preview(
  chargedPerCleanEmail({
    name: client.name,
    settled: [
      {
        label: "Commercial clean, Monday, January 12",
        settled: { ...settled, chargedCents: 32400 },
        unpaidCents: null,
      },
    ],
  }),
);
