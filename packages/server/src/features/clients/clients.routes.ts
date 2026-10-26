import { Router } from "express";
import { z } from "zod";
import { NotFoundError, RequestBodyError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { contactSchema } from "../quote-requests/quote-requests.validation.ts";
import {
  clientForAccount,
  clientView,
  findClientByEmail,
  officeClientView,
  updateContactDetails,
} from "./clients.ts";

export const router = Router();

const ownClient = async (accountId: string) => {
  const client = await clientForAccount(accountId);
  if (!client) throw new NotFoundError("Client not found");
  return client;
};

// the signed-in Client, with their Properties and Quote Requests
router.get("/me", authorize("client"), async (req, res) => {
  const client = await ownClient(signedInAccount(res).id);
  res.json(await clientView(client.id));
});

router.patch(
  "/me",
  authorize("client"),
  validate({ body: contactSchema }),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    const details = req.body;

    // each Client has their own email: Quotes and notices go there
    const other = await findClientByEmail(details.email);
    if (other && other.id !== client.id) {
      throw new RequestBodyError(
        new z.ZodError([
          {
            code: "custom",
            path: ["email"],
            message: "That email is already used by another Client",
            input: details.email,
          },
        ]),
      );
    }

    await updateContactDetails(client.id, details);
    res.json(await clientView(client.id));
  },
);

// any Client, for the Office, with their Quotes and Jobs
router.get(
  "/:id",
  authorize("office_staff"),
  validate({ params: z.object({ id: z.uuid() }) }),
  async (req, res) => {
    const view = await officeClientView(String(req.params.id));
    if (!view) throw new NotFoundError("Client not found");
    res.json(view);
  },
);
