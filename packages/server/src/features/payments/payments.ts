import { eq } from "drizzle-orm";
import type { PaymentMethodView } from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock } from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import {
  paymentGateway,
  PaymentMethodError,
  type SavedPaymentMethod,
} from "../../services/payment-gateway/index.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { paymentMethodLinkEmail } from "./emails.ts";
import {
  payers,
  paymentMethods,
  type PaymentMethodRow,
} from "./payments.schema.ts";

export const paymentMethodOf = async (
  clientId: string,
): Promise<PaymentMethodRow | undefined> => {
  const [saved] = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.clientId, clientId));
  return saved;
};

export const toPaymentMethodView = (
  saved: PaymentMethodRow | undefined,
): PaymentMethodView | null =>
  saved
    ? {
        label: saved.label,
        savedAt: saved.savedAt.toISOString(),
        consentedAt: saved.consentedAt.toISOString(),
      }
    : null;

// The Client's id with the payment provider, made the first time it's
// needed. Making it is idempotent at the provider, so two first payments at
// once still make one.
export const payerFor = async (
  client: Pick<Client, "id" | "name" | "email">,
) => {
  const [known] = await db
    .select()
    .from(payers)
    .where(eq(payers.clientId, client.id));
  if (known) return known.gatewayRef;

  const { payerId } = await paymentGateway.createPayer({
    clientId: client.id,
    name: client.name,
    email: client.email,
  });
  await db
    .insert(payers)
    .values({ clientId: client.id, gatewayRef: payerId })
    .onConflictDoNothing();
  return payerId;
};

// Keeps a card the Client has just saved with the provider as their Payment
// Method, in place of any they had. The form they saved it in says what
// they're agreeing to, so saving it is their consent to later Charges.
export const storePaymentMethod = async (
  clientId: string,
  saved: SavedPaymentMethod,
  tx: Tx | typeof db = db,
) => {
  const now = clock.now();
  const row = {
    clientId,
    gatewayRef: saved.paymentMethodId,
    label: saved.label,
    savedAt: now,
    consentedAt: now,
  };
  const [stored] = await tx
    .insert(paymentMethods)
    .values(row)
    .onConflictDoUpdate({ target: paymentMethods.clientId, set: row })
    .returning();
  return stored!;
};

// the provider's form for saving a card without paying (the add-a-card page)
export const startCardForm = async (client: Client) =>
  paymentGateway.startCardForm(await payerFor(client));

// Keeps the card a Client set up in that form as their Payment Method. Only
// the Client does this: Office Staff never handle card details.
export const savePaymentMethod = async (
  client: Client,
  token: string,
): Promise<PaymentMethodView> => {
  const payerId = await payerFor(client);
  const saved = await paymentGateway
    .savePaymentMethod({ payerId, token })
    .catch((error) => {
      if (error instanceof PaymentMethodError) {
        throw new ConflictError(error.message);
      }
      throw error;
    });
  return toPaymentMethodView(await storePaymentMethod(client.id, saved))!;
};

// Office Staff ask a Client to add a Payment Method themselves, so the
// Office can then record acceptance on their behalf. A plain link: it
// carries no sign-in power (ADR-0006).
export const sendPaymentMethodLink = async (clientId: string) => {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!client) throw new NotFoundError("Client not found");

  if (client.email) {
    await email.send({
      to: client.email,
      ...paymentMethodLinkEmail({ name: client.name, email: client.email }),
    });
  }
  return { sentTo: client.email };
};
