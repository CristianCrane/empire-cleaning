import { staffInviteEmail } from "../src/features/staff/emails.ts";
import { preview } from "../src/services/email/preview.tsx";

export default preview(
  staffInviteEmail({ name: "Ana Lopez", email: "ana@example.com" }),
);
