import { takenOffEmail } from "../src/features/assignments/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, cleaner } from "./samples.ts";

export default preview(takenOffEmail({ name: cleaner, clean }));
