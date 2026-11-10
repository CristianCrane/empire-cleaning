import { crewMovedEmail } from "../src/features/reschedule/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, cleaner, jobId, monday, wednesday, lang } from "./samples.ts";

export default preview(
  crewMovedEmail(lang, {
    name: cleaner,
    jobId,
    clean: { ...clean, startsAt: wednesday },
    from: monday,
  }),
);
