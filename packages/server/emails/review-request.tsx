import { reviewRequestEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { client } from "./samples.ts";

export default preview(
  reviewRequestEmail({
    name: client.name,
    reviewUrl: "https://search.google.com/local/writereview?placeid=sample",
  }),
);
