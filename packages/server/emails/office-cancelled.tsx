import { officeCancelledEmail } from "../src/features/cancellation/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId } from "./samples.ts";

export default preview(
  officeCancelledEmail({
    client: client.name,
    jobId,
    clean,
    onPlan: true,
    late: true,
    feeCents: 5046,
    failure: null,
  }),
);
