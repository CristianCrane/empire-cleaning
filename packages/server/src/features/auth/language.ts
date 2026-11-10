import { eq } from "drizzle-orm";
import type { Language, Me } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { paymentGateway } from "../../services/payment-gateway/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { payers } from "../payments/payments.schema.ts";
import { staff } from "../staff/staff.schema.ts";

// Preferred Language (ADR-0025), kept on each Client and Staff member: one
// person, one language, when it's their own change; the Office sets each on
// its own (#306).

// each area's, from its own record: the portal's from their Client, the
// Cleaner area's from their Staff member, null where it's connected to none.
// The Office sets each on its own (#306), so the two can differ
export const languagesOfAccount = async (
  accountId: string,
): Promise<Me["languages"]> => {
  const [[client], [member]] = await Promise.all([
    db
      .select({ language: clients.preferredLanguage })
      .from(clients)
      .where(eq(clients.accountId, accountId)),
    db
      .select({ language: staff.preferredLanguage })
      .from(staff)
      .where(eq(staff.accountId, accountId)),
  ]);
  return {
    portal: client?.language ?? null,
    cleaner: member?.language ?? null,
  };
};

// a Client's, as the Office sets it or as a person's own change writes it,
// and the payment provider told, whose own pages and emails follow it
export const setClientLanguage = async (
  clientId: string,
  language: Language,
) => {
  await db
    .update(clients)
    .set({ preferredLanguage: language })
    .where(eq(clients.id, clientId));
  const [payer] = await db
    .select()
    .from(payers)
    .where(eq(payers.clientId, clientId));
  if (payer) await paymentGateway.setPayerLanguage(payer.gatewayRef, language);
};

// a person's own change writes every Client and Staff member their Account
// is connected to
export const setOwnLanguage = async (accountId: string, language: Language) => {
  await db
    .update(staff)
    .set({ preferredLanguage: language })
    .where(eq(staff.accountId, accountId));
  const own = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.accountId, accountId));
  for (const { id } of own) await setClientLanguage(id, language);
};
