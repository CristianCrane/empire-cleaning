import { crewLostEmail } from "../src/features/reschedule/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, cleaner, monday, wednesday } from "./samples.ts";

export default preview(
  crewLostEmail({
    name: cleaner,
    clean: { ...clean, startsAt: wednesday },
    from: monday,
  }),
);
