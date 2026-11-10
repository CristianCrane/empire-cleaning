import { reminderEmail } from "../src/features/jobs/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, lang } from "./samples.ts";

export default preview(reminderEmail(lang, { name: client.name, clean }));
