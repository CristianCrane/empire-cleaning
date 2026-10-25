import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { paymentGateway } from "../../services/payment-gateway/index.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
import {
  paymentMethodOf,
  savePaymentMethod,
  sendPaymentMethodLink,
  toPaymentMethodView,
} from "./payments.ts";

export const router = Router();

const ownClient = async (accountId: string) => {
  const client = await clientForAccount(accountId);
  if (!client) throw new NotFoundError("Client not found");
  return client;
};

// ---- the signed-in Client's own Payment Method ----

// what they have saved, or null
router.get("/mine", authorize("client"), async (req, res) => {
  const client = await ownClient(signedInAccount(res).id);
  res.json(toPaymentMethodView(await paymentMethodOf(client.id)));
});

// the provider's card form, to show in the browser
router.post("/mine/card-form", authorize("client"), async (req, res) => {
  await ownClient(signedInAccount(res).id);
  res.json(await paymentGateway.startCardForm());
});

// keeps what the card form set up, replacing any saved before
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
    res.json(await savePaymentMethod(client.id, req.body.token));
  },
);

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
