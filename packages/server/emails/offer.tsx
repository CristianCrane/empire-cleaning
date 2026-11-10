import { offerEmail } from "../src/features/assignments/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, cleaner, jobId, lang } from "./samples.ts";

export default preview(offerEmail(lang, { name: cleaner, jobId, clean }));
