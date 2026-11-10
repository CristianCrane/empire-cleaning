import { siteVisitChangedEmail } from "../src/features/site-visits/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, lang, monday, wednesday } from "./samples.ts";

export default preview(
  siteVisitChangedEmail(lang, {
    name: client.name,
    address,
    startsAt: monday,
    visitor: "Olive Owner",
    minutes: 30,
    place: "home",
    was: wednesday,
  }),
);
