import { askClashEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, lang } from "./samples.ts";

export default preview(
  askClashEmail(lang, {
    ...client,
    address,
    kind: "residential",
    why: "asked",
  }),
);
