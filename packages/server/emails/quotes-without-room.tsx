import { quotesWithoutRoomEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, monday } from "./samples.ts";

export default preview(
  quotesWithoutRoomEmail({
    quotes: [
      { client: client.name, address, startsAt: monday },
      {
        client: "Olive Owner",
        address: "200 Park Ave S, Floor 3, 10003",
        startsAt: monday,
      },
    ],
  }),
);
