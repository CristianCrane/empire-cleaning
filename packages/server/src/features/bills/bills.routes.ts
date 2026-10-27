import { Router } from "express";
import { z } from "zod";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
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

const bill = z.object({ id: z.uuid() });

// ---- the signed-in Client: /api/bills/mine ----

const signedInClient = async (accountId: string) => {
  const client = await clientForAccount(accountId);
  if (!client) throw new NotFoundError("Client not found");
  return client;
};

// their Bills, newest first
router.get("/mine", authorize("client"), async (req, res) => {
  const client = await signedInClient(signedInAccount(res).id);
  res.json(await listBills({ clientId: client.id }));
});

// one of their Bills; anyone else's doesn't exist for them
router.get(
  "/mine/:id",
  authorize("client"),
  validate({ params: bill }),
  async (req, res) => {
    const client = await signedInClient(signedInAccount(res).id);
    res.json(await billView(String(req.params.id), client.id));
  },
);

// the provider's form for paying it on its page, by card or bank debit
router.post(
  "/mine/:id/payment-form",
  authorize("client"),
  validate({ params: bill }),
  async (req, res) => {
    const client = await signedInClient(signedInAccount(res).id);
    res.json(await startBillPayment(client, String(req.params.id)));
  },
);

// once that form is done: paid, or a bank debit on its way
router.post(
  "/mine/:id/payment",
  authorize("client"),
  validate({
    params: bill,
    body: z.object({ ref: z.string().min(1) }),
  }),
  async (req, res) => {
    const client = await signedInClient(signedInAccount(res).id);
    const id = String(req.params.id);
    await billView(id, client.id);
    const failure = await finishBillPayment(id, req.body.ref);
    if (failure) {
      throw new ConflictError(
        `Your payment didn't go through (${failure}). Please try again, or use another card or account.`,
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
      unpaid: z.enum(["true", "false"]).optional(),
    }),
  }),
  async (req, res) => {
    res.json(
      await listBills({
        clientId: req.query.clientId as string | undefined,
        unpaid: req.query.unpaid === "true",
      }),
    );
  },
);

router.get(
  "/:id",
  authorize("office_staff"),
  validate({ params: bill }),
  async (req, res) => {
    res.json(await billView(String(req.params.id)));
  },
);

router.post(
  "/:id/void",
  authorize("office_staff"),
  validate({
    params: bill,
    body: z.object({
      reason: z
        .string({ error: "Say why it's voided" })
        .trim()
        .min(1, "Say why it's voided")
        .max(500, "Use a shorter reason"),
    }),
  }),
  async (req, res) => {
    res.json(
      await voidBill(String(req.params.id), {
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
    params: bill,
    body: z.object({
      note: z
        .string({ error: "Say how it was paid" })
        .trim()
        .min(1, "Say how it was paid")
        .max(500, "Use a shorter note"),
    }),
  }),
  async (req, res) => {
    res.json(
      await recordOutsidePayment(String(req.params.id), {
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
    params: z.object({ id: z.uuid() }),
    body: z.object({
      weekly: z.boolean(),
      payment: z.enum(["automatic", "on_page"], {
        error: "Choose how they pay",
      }),
      termsDays: z
        .number({ error: "Enter their terms in days" })
        .int("Enter whole days")
        .min(1, "Give them at least a day")
        .max(90, "Terms can be up to 90 days"),
      billingEmail: z.email("Enter a valid email").nullable(),
    }),
  }),
  async (req, res) => {
    res.json(await setBilling(String(req.params.id), req.body));
  },
);
