import { staffInviteEmail } from "../src/features/staff/emails.ts";
import { EmailLayout } from "../src/services/email/layout.tsx";

export default function StaffInvite() {
  return (
    <EmailLayout
      email={staffInviteEmail({
        name: "Ana Lopez",
        email: "ana@example.com",
        signInUrl: "http://localhost:5173/sign-in",
      })}
    />
  );
}
