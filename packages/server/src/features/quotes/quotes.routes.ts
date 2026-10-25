import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
import { acceptQuote } from "./accept.ts";
import { quotesForClient } from "./quote-state.ts";
import {
  clientQuote,
  declineQuote,
  officeQuote,
  saveDraft,
  sendQuote,
  startDraft,
} from "./quotes.ts";
import { acceptSchema, draftSchema, startSchema } from "./quotes.validation.ts";

export const router = Router();

const byId = { params: z.object({ id: z.uuid() }) };

const ownClient = async (accountId: string) => {
  const client = await clientForAccount(accountId);
  if (!client) throw new NotFoundError("Client not found");
  return client;
};

// ---- the signed-in Client's own Quotes (never Drafts) ----

router.get("/mine", authorize("client"), async (req, res) => {
  const client = await ownClient(signedInAccount(res).id);
  res.json(await quotesForClient(client.id));
});

router.get(
  "/mine/:id",
  authorize("client"),
  validate(byId),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    res.json(await clientQuote(String(req.params.id), client.id));
  },
);

// accepts with the Clean Type chosen, charging the Deposit to the Client's
// saved Payment Method and booking the Job
router.post(
  "/mine/:id/accept",
  authorize("client"),
  validate({ ...byId, body: acceptSchema }),
  async (req, res) => {
    const account = signedInAccount(res);
    const client = await ownClient(account.id);
    const id = String(req.params.id);
    await acceptQuote(id, req.body.cleanType, {
      by: "client",
      clientId: client.id,
      accountId: account.id,
    });
    res.json(await clientQuote(id, client.id));
  },
);

router.post(
  "/mine/:id/decline",
  authorize("client"),
  validate(byId),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    res.json(await declineQuote(String(req.params.id), client.id));
  },
);

// ---- the Office ----

// starts a Draft for a Quote Request, or returns the one it has
router.post(
  "/",
  authorize("office_staff"),
  validate({ body: startSchema }),
  async (req, res) => {
    const { quote, started } = await startDraft(
      req.body.quoteRequestId,
      signedInAccount(res).id,
    );
    res.status(started ? 201 : 200).json(quote);
  },
);

router.get(
  "/:id",
  authorize("office_staff"),
  validate(byId),
  async (req, res) => {
    res.json(await officeQuote(String(req.params.id)));
  },
);

router.patch(
  "/:id",
  authorize("office_staff"),
  validate({ ...byId, body: draftSchema }),
  async (req, res) => {
    res.json(await saveDraft(String(req.params.id), req.body));
  },
);

router.post(
  "/:id/send",
  authorize("office_staff"),
  validate(byId),
  async (req, res) => {
    res.json(await sendQuote(String(req.params.id)));
  },
);

// records the Client's acceptance on their behalf, e.g. by phone; charges
// their saved Payment Method
router.post(
  "/:id/accept",
  authorize("office_staff"),
  validate({ ...byId, body: acceptSchema }),
  async (req, res) => {
    const id = String(req.params.id);
    await acceptQuote(id, req.body.cleanType, {
      by: "office",
      accountId: signedInAccount(res).id,
    });
    res.json(await officeQuote(id));
  },
);
