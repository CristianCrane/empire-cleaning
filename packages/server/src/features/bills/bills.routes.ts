import { Router } from "express";
import { z } from "zod";
import { ConflictError } from "../../middleware/errors.ts";
import { byId, keepUnder, validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { ownClient } from "../clients/clients.ts";
import { whyNotPaid } from "../payments/unpaid.ts";
import {
  billView,
  finishBillPayment,
  listBills,
  recordOutsidePayment,
  setBilling,
  startBillPayment,
  voidBill,
} from "./bills.ts";

export const router = Router();

// ---- the signed-in Client: /api/bills/mine ----

// their Bills, newest first
router.get("/mine", authorize("client"), async (_req, res) => {
  const client = await ownClient(signedInAccount(res).id);
  res.json(await listBills({ clientId: client.id }));
});

// one of their Bills; anyone else's doesn't exist for them
router.get(
  "/mine/:id",
  authorize("client"),
  validate({ params: byId }),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    res.json(await billView(req.params.id, client.id));
  },
);

// the provider's form for paying it on its page, by card or bank debit
router.post(
  "/mine/:id/payment-form",
  authorize("client"),
  validate({ params: byId }),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    res.json(await startBillPayment(client, req.params.id));
  },
);

// once that form is done: paid, or a bank debit on its way
router.post(
  "/mine/:id/payment",
  authorize("client"),
  validate({
    params: byId,
    body: z.object({ ref: z.string().min(1) }),
  }),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    const id = req.params.id;
    await billView(id, client.id);
    const failure = await finishBillPayment(id, req.body.ref);
    if (failure) {
      const { why } = whyNotPaid(failure);
      throw new ConflictError(
        `Your payment didn't go through${why ? ` (${why})` : ""}. Please try again, or use another card or bank account.`,
      );
    }
    res.json(await billView(id, client.id));
  },
);

// ---- the Office: /api/bills ----

// every Bill, a Client's (?clientId=), or only Unpaid ones (?unpaid=true),
// newest first
router.get(
  "/",
  authorize("office_staff"),
  validate({
    query: z.object({
      clientId: z.uuid().optional(),
      unpaid: z
        .enum(["true", "false"])
        .transform((unpaid) => unpaid === "true")
        .optional(),
    }),
  }),
  async (req, res) => {
    res.json(
      await listBills({
        clientId: req.query.clientId,
        unpaid: req.query.unpaid ?? false,
      }),
    );
  },
);

router.get(
  "/:id",
  authorize("office_staff"),
  validate({ params: byId }),
  async (req, res) => {
    res.json(await billView(req.params.id));
  },
);

router.post(
  "/:id/void",
  authorize("office_staff"),
  validate({
    params: byId,
    body: z.object({
      reason: z
        .string({ error: "Say why it's cancelled" })
        .trim()
        .min(1, "Say why it's cancelled")
        .max(500, keepUnder(500, "the reason")),
    }),
  }),
  async (req, res) => {
    res.json(
      await voidBill(req.params.id, {
        byAccountId: signedInAccount(res).id,
        reason: req.body.reason,
      }),
    );
  },
);

// a payment made another way, such as a cheque or bank transfer
router.post(
  "/:id/outside-payment",
  authorize("office_staff"),
  validate({
    params: byId,
    body: z.object({
      note: z
        .string({ error: "Say how it was paid" })
        .trim()
        .min(1, "Say how it was paid")
        .max(500, keepUnder(500, "the note")),
    }),
  }),
  async (req, res) => {
    res.json(
      await recordOutsidePayment(req.params.id, {
        byAccountId: signedInAccount(res).id,
        note: req.body.note,
      }),
    );
  },
);

// ---- a Client's billing: /api/clients/:id/billing ----

export const clientBillingRouter = Router();

clientBillingRouter.put(
  "/:id/billing",
  authorize("office_staff"),
  validate({
    params: byId,
    body: z.object({
      weekly: z.boolean(),
      payment: z.enum(["automatic", "on_page"], {
        error: "Choose how they pay",
      }),
      termsDays: z
        .number({ error: "Enter how many days they have to pay" })
        .int("Enter whole days")
        .min(1, "Give them at least a day")
        .max(90, "Give them 90 days at most"),
      billingEmail: z.email("Enter a valid email").nullable(),
    }),
  }),
  async (req, res) => {
    res.json(await setBilling(req.params.id, req.body));
  },
);
