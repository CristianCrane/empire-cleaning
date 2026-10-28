import { signInEmail } from "../src/features/auth/emails.ts";
import { EmailLayout } from "../src/services/email/layout.tsx";

export default function SignIn() {
  return (
    <EmailLayout
      email={signInEmail({
        url: "http://localhost:3000/api/auth/magic-link/verify?token=sample",
      })}
    />
  );
}
