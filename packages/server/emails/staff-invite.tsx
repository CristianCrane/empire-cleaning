import { staffInviteEmail } from "../src/features/staff/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { lang } from "./samples.ts";

export default preview(
  staffInviteEmail(lang, { name: "Ana Lopez", email: "ana@example.com" }),
);
