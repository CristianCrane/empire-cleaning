import { offerEmail } from "../src/features/assignments/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, cleaner, jobId } from "./samples.ts";

export default preview(offerEmail({ name: cleaner, jobId, clean }));
