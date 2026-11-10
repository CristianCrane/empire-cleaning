import { signInEmail } from "../src/features/auth/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { lang } from "./samples.ts";

export default preview(
  signInEmail(lang, {
    url: "http://localhost:3000/api/auth/magic-link/verify?token=sample",
  }),
);
