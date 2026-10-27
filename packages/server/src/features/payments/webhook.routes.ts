import express, { Router } from "express";
import { paymentGateway } from "../../services/payment-gateway/index.ts";
import { finishBillPayment } from "../bills/bills.ts";
import { finalizeDeposit } from "../quotes/accept.ts";

// What the payment provider tells us happened, e.g. a Deposit that succeeded
// after the Client's browser lost its connection. It reads the raw body, to
// check the provider's signature, so it's mounted before express.json().
export const webhookRouter = Router();

webhookRouter.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;
    try {
      event = paymentGateway.parseEvent(req.body as Buffer, req.headers);
    } catch {
      res.status(400).json({ message: "Invalid signature" });
      return;
    }

    switch (event?.kind) {
      case "deposit_succeeded":
        // books it if the browser hasn't already; a no-op if it has
        await finalizeDeposit(event.ref);
        break;
      // a Bill paid on its page: a card the browser may not have told us of,
      // or a bank debit clearing, or failing, days later
      case "bill_payment_succeeded":
      case "bill_payment_failed":
        if (event.reference)
          await finishBillPayment(event.reference, event.ref);
        break;
      // TODO(#41): raise these as monitoring signals, and record refunds
      // made in the provider's dashboard against their Job
      case "charge_refunded":
        console.warn(`Charge ${event.chargeId} was refunded at the provider`);
        break;
      case "dispute_opened":
        console.warn(`Charge ${event.chargeId} is disputed`);
        break;
    }
    res.json({ received: true });
  },
);
