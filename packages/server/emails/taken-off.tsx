import { takenOffEmail } from "../src/features/assignments/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, cleaner, lang } from "./samples.ts";

export default preview(takenOffEmail(lang, { name: cleaner, clean }));
