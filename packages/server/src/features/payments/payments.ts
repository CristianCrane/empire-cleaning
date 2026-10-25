import { eq } from "drizzle-orm";
import type { PaymentMethodView } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import env from "../../env.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock } from "../../services/clock/index.ts";
import { compose, email, firstNameOf } from "../../services/email/index.ts";
import {
  paymentGateway,
  PaymentMethodError,
} from "../../services/payment-gateway/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { paymentMethods, type PaymentMethodRow } from "./payments.schema.ts";

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
  saved ? { label: saved.label, savedAt: saved.savedAt.toISOString() } : null;

// Keeps the card a Client set up in the provider's card form as their
// Payment Method, in place of any they had. Only the Client does this: Office
// Staff never handle card details.
export const savePaymentMethod = async (
  clientId: string,
  token: string,
): Promise<PaymentMethodView> => {
  const saved = await paymentGateway
    .savePaymentMethod({ clientId, token })
    .catch((error) => {
      if (error instanceof PaymentMethodError) {
        throw new ConflictError(error.message);
      }
      throw error;
    });
  const row = {
    clientId,
    gatewayRef: saved.paymentMethodId,
    label: saved.label,
    savedAt: clock.now(),
  };
  const [stored] = await db
    .insert(paymentMethods)
    .values(row)
    .onConflictDoUpdate({ target: paymentMethods.clientId, set: row })
    .returning();
  return toPaymentMethodView(stored)!;
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

  await email.send({
    to: client.email,
    subject: "Add a Payment Method for Empire Cleaning",
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        "To book your clean we need a card on file: we take the Deposit when you book and the rest when the clean is done. You enter it yourself, straight into our payment provider's secure form, so we never see your card number.",
        `Sign in with this email address (${client.email}) to add it:`,
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/payment-method`,
        label: "Add a Payment Method",
      },
    ),
  });
  return { sentTo: client.email };
};
