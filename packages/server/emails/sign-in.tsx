import { signInEmail } from "../src/features/auth/emails.ts";
import { preview } from "../src/services/email/preview.tsx";

export default preview(
  signInEmail({
    url: "http://localhost:3000/api/auth/magic-link/verify?token=sample",
  }),
);
