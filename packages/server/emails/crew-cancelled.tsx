import { crewCancelledEmail } from "../src/features/cancellation/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, cleaner } from "./samples.ts";

export default preview(crewCancelledEmail({ name: cleaner, clean }));
