import { crewCancelledEmail } from "../src/features/cancellation/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, cleaner, lang } from "./samples.ts";

export default preview(crewCancelledEmail(lang, { name: cleaner, clean }));
