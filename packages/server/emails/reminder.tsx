import { reminderEmail } from "../src/features/jobs/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client } from "./samples.ts";

export default preview(reminderEmail({ name: client.name, clean }));
