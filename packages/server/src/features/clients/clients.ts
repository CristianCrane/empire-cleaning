import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { connectSignedUpAccount } from "../auth/connections.ts";
import { clients } from "./clients.schema.ts";

type NewClient = { email: string; name: string };

// adds a Client; Quote Requests (#3) are what create them. If someone has
// already signed up with this email, their Account is connected straight away.
export const createClient = async ({ email, name }: NewClient) => {
  const [client] = await db
    .insert(clients)
    .values({ email: email.trim().toLowerCase(), name })
    .returning();
  await connectSignedUpAccount(client!.email);

  return client!;
};

// e.g. Office Staff correcting a Client who signed up with a different email
// from their Quote Request; if that Account exists it connects straight away
export const changeClientEmail = async (id: string, email: string) => {
  const address = email.trim().toLowerCase();
  await db.update(clients).set({ email: address }).where(eq(clients.id, id));
  await connectSignedUpAccount(address);
};
