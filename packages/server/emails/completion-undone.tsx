import { completionUndoneEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, lang, settled } from "./samples.ts";

export default preview(
  completionUndoneEmail(lang, {
    name: client.name,
    clean,
    settled: { ...settled, refundedCents: 23952 },
  }),
);
