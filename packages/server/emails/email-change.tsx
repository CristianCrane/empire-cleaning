import { emailChangeEmail } from "../src/features/clients/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { lang } from "./samples.ts";

export default preview(emailChangeEmail(lang, { token: "sample" }));
