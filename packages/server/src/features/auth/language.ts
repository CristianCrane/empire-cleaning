import { eq } from "drizzle-orm";
import type { Language } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { paymentGateway } from "../../services/payment-gateway/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { payers } from "../payments/payments.schema.ts";

// An Account's Preferred Language (ADR-0025): one person, one language, kept
// on each Client (and, from #305, Staff member) their Account is connected
// to.

// the Account's, from its Client; null while it's connected to none
export const languageOfAccount = async (
  accountId: string,
): Promise<Language | null> => {
  const [client] = await db
    .select({ language: clients.preferredLanguage })
    .from(clients)
    .where(eq(clients.accountId, accountId));
  return client?.language ?? null;
};

// a person's own change writes every Client their Account is connected to,
// and tells the payment provider, whose own pages and emails follow it
export const setOwnLanguage = async (accountId: string, language: Language) => {
  const changed = await db
    .update(clients)
    .set({ preferredLanguage: language })
    .where(eq(clients.accountId, accountId))
    .returning({ id: clients.id });
  for (const { id } of changed) {
    const [payer] = await db
      .select()
      .from(payers)
      .where(eq(payers.clientId, id));
    if (payer)
      await paymentGateway.setPayerLanguage(payer.gatewayRef, language);
  }
};
