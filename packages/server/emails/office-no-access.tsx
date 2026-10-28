import { officeNoAccessEmail } from "../src/features/cancellation/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, cleaner, client, jobId } from "./samples.ts";

export default preview(
  officeNoAccessEmail({
    cleaner,
    client: client.name,
    jobId,
    clean,
    reason: "Nobody home and the gate was locked",
    onPlan: false,
    failure: null,
  }),
);
