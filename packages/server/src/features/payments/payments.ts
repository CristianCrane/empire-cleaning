import { eq } from "drizzle-orm";
import { log } from "#services/monitoring";
import { currentLanguage } from "#services/request";
import {
  catalog,
  messages,
  type PaymentMethodView,
} from "@empire-cleaning/models";
import { apart, db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock } from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import {
  paymentGateway,
  PaymentMethodError,
  type SavedPaymentMethod,
} from "../../services/payment-gateway/index.ts";
export { cardIn } from "./payments.schema.ts";
import { weeklyBillOf } from "../bills/billed-weekly.ts";
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
        label: messages[currentLanguage()].card(saved),
        savedAt: saved.savedAt.toISOString(),
        consentedAt: saved.consentedAt.toISOString(),
      }
    : null;

// The Client's id with the payment provider, made the first time it's
// needed. Making it is idempotent at the provider, so two first payments at
// once still make one. Kept apart from any transaction around it, as it
// stands at the provider whatever that does.
export const payerFor = async (
  client: Pick<Client, "id" | "name" | "email" | "preferredLanguage">,
) => {
  const [known] = await apart
    .select()
    .from(payers)
    .where(eq(payers.clientId, client.id));
  if (known) return known.gatewayRef;

  const { payerId } = await paymentGateway.createPayer({
    clientId: client.id,
    name: client.name,
    email: client.email,
    language: client.preferredLanguage,
  });
  await apart
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
    ...saved.card,
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

// what the Client reads when the provider refused the form's result, in
// the request's language (ADR-0025); the provider's own words are for the
// logs
export const cardWords = catalog({
  en: {
    NOT_SET_UP: "Your card wasn't set up. Please enter it again.",
    ENTER_CARD: "Enter your card",
  },
  es: {
    NOT_SET_UP: "Su tarjeta no se guardó. Vuelva a ingresarla.",
    ENTER_CARD: "Ingrese su tarjeta",
  },
});

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
        log.info(`Card not saved for Client ${client.id}: ${error.message}`);
        throw new ConflictError(cardWords[currentLanguage()].NOT_SET_UP);
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
      ...paymentMethodLinkEmail(client.preferredLanguage, {
        name: client.name,
        email: client.email,
        weeklyBill: weeklyBillOf(client),
      }),
    });
  }
  return { sentTo: client.email };
};
