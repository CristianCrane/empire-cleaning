import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { paymentGateway } from "../../services/payment-gateway/index.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
import { retryUnpaidBillsFor } from "../bills/bills.ts";
import { retryUnpaidJobsFor } from "../completion/completion.ts";
import { paymentHistoryFor } from "./history.ts";
import {
  paymentMethodOf,
  savePaymentMethod,
  sendPaymentMethodLink,
  startCardForm,
  toPaymentMethodView,
} from "./payments.ts";

export const router = Router();

const ownClient = async (accountId: string) => {
  const client = await clientForAccount(accountId);
  if (!client) throw new NotFoundError("Client not found");
  return client;
};

// which of the provider's payment forms the browser shows, e.g. for paying
// a Deposit
router.get("/form", authorize("client"), (req, res) => {
  res.json(paymentGateway.paymentForm());
});

// ---- the signed-in Client's own Payment Method ----

// what they have saved, or null
router.get("/mine", authorize("client"), async (req, res) => {
  const client = await ownClient(signedInAccount(res).id);
  res.json(toPaymentMethodView(await paymentMethodOf(client.id)));
});

// the provider's form for saving a card without paying, to show in the
// browser
router.post("/mine/card-form", authorize("client"), async (req, res) => {
  const client = await ownClient(signedInAccount(res).id);
  res.json(await startCardForm(client));
});

// keeps what that form set up, replacing any saved before, and tries any
// Unpaid Jobs and Bills again with it
router.put(
  "/mine",
  authorize("client"),
  validate({
    body: z.object({
      token: z.string({ error: "Enter your card" }).min(1, "Enter your card"),
    }),
  }),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    const saved = await savePaymentMethod(client, req.body.token);
    await retryUnpaidJobsFor(client.id);
    await retryUnpaidBillsFor(client.id);
    res.json(saved);
  },
);

// ---- the signed-in Client's payments ----

export const historyRouter = Router();

// every payment between them and us, newest first
historyRouter.get("/mine", authorize("client"), async (req, res) => {
  const client = await ownClient(signedInAccount(res).id);
  res.json(await paymentHistoryFor(client.id));
});

// ---- the Office ----

// emails a Client a link to add a Payment Method themselves
router.post(
  "/requests",
  authorize("office_staff"),
  validate({ body: z.object({ clientId: z.uuid("Choose a Client") }) }),
  async (req, res) => {
    res.json(await sendPaymentMethodLink(req.body.clientId));
  },
);
