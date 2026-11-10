import { chargedPerCleanEmail } from "../src/features/bills/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, lang, settled } from "./samples.ts";

export default preview(
  chargedPerCleanEmail(lang, {
    name: client.name,
    settled: [
      {
        jobId,
        clean,
        fee: null,
        settled: { ...settled, chargedCents: 32400 },
        unpaidCents: null,
      },
    ],
  }),
);
