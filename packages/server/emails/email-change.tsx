import { emailChangeEmail } from "../src/features/clients/emails.ts";
import { preview } from "../src/services/email/preview.tsx";

export default preview(emailChangeEmail({ token: "sample" }));
