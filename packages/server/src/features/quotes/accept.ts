import { and, eq } from "drizzle-orm";
import type { CleanType } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import env from "../../env.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock, dayOf } from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatMoney,
  formatWhen,
} from "../../services/email/index.ts";
import { paymentGateway } from "../../services/payment-gateway/index.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { bookJob, lockDay } from "../jobs/jobs.ts";
import type { Job } from "../jobs/jobs.schema.ts";
import { hasRoomFor } from "../jobs/schedule.ts";
import { paymentMethodOf } from "../payments/payments.ts";
import { charges } from "../payments/payments.schema.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { quoteRequests } from "../quote-requests/quote-requests.schema.ts";
import { statusOf } from "./quote-state.ts";
import { lockRequest, toOption } from "./quotes.ts";
import { quoteOptions, quotes, type Quote } from "./quotes.schema.ts";

// who is accepting: the Client, from the portal, or Office Staff recording
// the Client's acceptance on their behalf (they never enter card details: the
// Client's saved Payment Method is charged)
export type Acceptor =
  | { by: "client"; clientId: string; accountId: string }
  | { by: "office"; accountId: string };

const cleanTypeLabel = { deep: "Deep Clean", standard: "Standard Clean" };

// only a Sent Quote can be Accepted, and only before it Expires
const refuseUnlessOpen = (quote: Quote, acceptor: Acceptor) => {
  const status = statusOf(quote);
  if (status === "sent") return;
  throw new ConflictError(
    {
      draft: "Send the Quote before recording its acceptance.",
      accepted: "This Quote has already been accepted.",
      declined: "This Quote was declined, so it can't be accepted.",
      expired:
        acceptor.by === "client"
          ? "This Quote has expired, so it can't be accepted. Ask us for a new Quote and we'll find another time."
          : "This Quote has expired, so it can't be accepted. Send a new one.",
      superseded: "A newer Quote replaces this one, so it can't be accepted.",
    }[status],
  );
};

/**
 * Accepts a Sent Quote with the Clean Type chosen, as one step: the proposed
 * day must still have room for its Labour Hours, and the Deposit must be
 * charged to the Client's saved Payment Method; only then is the Quote
 * Accepted and the Job booked (ADR-0001). If either fails, nothing changes
 * and the Quote stays Sent.
 *
 * The day stays locked from checking its room to booking it, so two
 * acceptances can't both take its last free hours. The Deposit is charged
 * inside that, and refunded if the booking then fails to save.
 */
export const acceptQuote = async (
  id: string,
  cleanType: CleanType,
  acceptor: Acceptor,
): Promise<Job> => {
  const [found] = await db
    .select({ quote: quotes, client: clients, property: properties })
    .from(quotes)
    .innerJoin(quoteRequests, eq(quoteRequests.id, quotes.quoteRequestId))
    .innerJoin(clients, eq(clients.id, quoteRequests.clientId))
    .innerJoin(properties, eq(properties.id, quoteRequests.propertyId))
    .where(eq(quotes.id, id));
  // Drafts and other Clients' Quotes don't exist for a Client
  if (
    !found ||
    (acceptor.by === "client" &&
      (found.client.id !== acceptor.clientId || found.quote.status === "draft"))
  ) {
    throw new NotFoundError("Quote not found");
  }
  const { quote, client, property } = found;
  refuseUnlessOpen(quote, acceptor);

  const paymentMethod = await paymentMethodOf(client.id);
  if (!paymentMethod) {
    throw new ConflictError(
      acceptor.by === "client"
        ? "Add a Payment Method to accept this Quote."
        : `${client.name} hasn't added a Payment Method yet. Email them a link to add one.`,
    );
  }

  const [row] = await db
    .select()
    .from(quoteOptions)
    .where(
      and(eq(quoteOptions.quoteId, id), eq(quoteOptions.cleanType, cleanType)),
    );
  const option = toOption(quote, row!);
  const startsAt = quote.proposedStartsAt!;
  const day = dayOf(startsAt);

  // set inside the transaction; `as` stops TypeScript deciding it's always null
  let chargeId = null as string | null;
  let job: Job;
  try {
    job = await db.transaction(async (tx) => {
      await lockRequest(tx, quote.quoteRequestId);
      const [current] = await tx
        .select()
        .from(quotes)
        .where(eq(quotes.id, id))
        .for("update");
      refuseUnlessOpen(current!, acceptor);

      await lockDay(tx, day);
      const { hasRoom } = await hasRoomFor(day, option.labourHours);
      if (!hasRoom) {
        throw new ConflictError(
          acceptor.by === "client"
            ? "Sorry, that time has just been booked up, so nothing has been charged. We'll be in touch with another time."
            : "That day no longer has room for this Job, so nothing was charged. Send a Quote for another time.",
        );
      }

      const now = clock.now();
      const booked = await bookJob(
        {
          propertyId: property.id,
          cleanType,
          startsAt,
          labourHours: option.labourHours,
          crewSize: quote.crewSize,
        },
        tx,
      );

      // a 0% Deposit takes nothing now; the card is still kept for the
      // Balance
      if (option.depositCents > 0) {
        const result = await paymentGateway.charge({
          paymentMethodId: paymentMethod.gatewayRef,
          amount: option.depositCents,
          description: `Deposit: ${cleanTypeLabel[cleanType]} at ${addressOf(property)}, ${formatWhen(startsAt)}`,
        });
        if (!result.ok) {
          throw new ConflictError(
            acceptor.by === "client"
              ? "Your card couldn't be charged, so nothing has been booked. Please try another card."
              : `The Deposit couldn't be charged to ${client.name}'s ${paymentMethod.label} (${result.reason}), so nothing has been booked.`,
          );
        }
        chargeId = result.chargeId;
        await tx.insert(charges).values({
          jobId: booked.id,
          kind: "deposit",
          amountCents: option.depositCents,
          gatewayRef: chargeId,
          chargedAt: now,
        });
      }

      await tx
        .update(quotes)
        .set({
          status: "accepted",
          acceptedAt: now,
          acceptedCleanType: cleanType,
          jobId: booked.id,
          acceptedBy: acceptor.accountId,
        })
        .where(eq(quotes.id, id));
      return booked;
    });
  } catch (error) {
    // charged, but nothing was booked: give it back
    if (chargeId) {
      const refunded = await paymentGateway
        .refund({ chargeId, amount: option.depositCents })
        .catch((e: unknown) => ({ ok: false, reason: String(e) }));
      if (!refunded.ok) {
        console.error(
          `Deposit ${chargeId} for Quote ${id} was charged but not booked, and couldn't be refunded (${refunded.reason}): refund it by hand`,
        );
      }
    }
    throw error;
  }

  // the Job is booked: an email that can't go mustn't make it look as though
  // it wasn't
  try {
    await sendBookingConfirmation(client, property, job, {
      depositCents: option.depositCents,
      totalCents: option.totalCents,
      paymentMethod: paymentMethod.label,
    });
  } catch (error) {
    console.error(`booking confirmation for Job ${job.id} not sent:`, error);
  }
  return job;
};

const sendBookingConfirmation = async (
  client: Client,
  property: Property,
  job: Job,
  paid: { depositCents: number; totalCents: number; paymentMethod: string },
) => {
  const balance = paid.totalCents - paid.depositCents;
  await email.send({
    to: client.email,
    subject: "You're booked with Empire Cleaning",
    ...compose(
      [
        `Hi ${firstNameOf(client.name)},`,
        `You're booked: a ${cleanTypeLabel[job.cleanType]} at ${addressOf(property)} on ${formatWhen(job.startsAt)}.`,
        paid.depositCents > 0
          ? `We've taken your Deposit of ${formatMoney(paid.depositCents)} from your ${paid.paymentMethod}. The rest, ${formatMoney(balance)}, is charged to it when the clean is done.`
          : `The ${formatMoney(paid.totalCents)} is charged to your ${paid.paymentMethod} when the clean is done.`,
        "We'll remind you the day before. Please check your Access Instructions, so our team can get in:",
      ],
      {
        href: `${env.CORS_ORIGIN_URL}/portal/details`,
        label: "Check your Access Instructions",
      },
    ),
  });
};
