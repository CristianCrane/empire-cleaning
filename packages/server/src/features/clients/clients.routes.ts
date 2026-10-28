import { Router } from "express";
import { z } from "zod";
import { NotFoundError, RequestBodyError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { contactSchema } from "../quotes/asking.validation.ts";
import {
  clientForAccount,
  clientView,
  findClientByEmail,
  listClients,
  officeClientView,
  officeUpdateContactDetails,
  updateContactDetails,
} from "./clients.ts";
import { clientStandings } from "./standing.ts";

export const router = Router();

const ownClient = async (accountId: string) => {
  const client = await clientForAccount(accountId);
  if (!client) throw new NotFoundError("Client not found");
  return client;
};

// the signed-in Client, with their Properties and Quotes
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

    await refuseOthersEmail(client.id, details.email);
    await updateContactDetails(client.id, details);
    res.json(await clientView(client.id));
  },
);

// each Client has their own email: Quotes and notices go there
const refuseOthersEmail = async (clientId: string, email: string | null) => {
  const other = email ? await findClientByEmail(email) : undefined;
  if (other && other.id !== clientId) {
    throw new RequestBodyError(
      new z.ZodError([
        {
          code: "custom",
          path: ["email"],
          message: "That email is already used by another Client",
          input: email,
        },
      ]),
    );
  }
};

// Office Staff correcting a Client's contact details and business name, or
// adding the email of one they entered without it; an email can't be removed
router.patch(
  "/:id",
  authorize("office_staff"),
  validate({
    params: z.object({ id: z.uuid() }),
    body: contactSchema.extend({
      email: contactSchema.shape.email.nullable(),
      businessName: z
        .string()
        .trim()
        .max(200, "Use a shorter business name")
        .nullish(),
    }),
  }),
  async (req, res) => {
    const id = String(req.params.id);
    await refuseOthersEmail(id, req.body.email);
    const view = await officeUpdateContactDetails(id, req.body);
    if (!view) throw new NotFoundError("Client not found");
    res.json(view);
  },
);

const listQuery = z.object({
  q: z.string().max(200).optional(),
  standing: z.enum([...clientStandings, "all"]).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

// a page of the Office's Clients: those matching ?q=, with ?standing= (or
// any), the first ?limit= of them (see listClients)
router.get(
  "/",
  authorize("office_staff"),
  validate({ query: listQuery }),
  async (req, res) => {
    const { q, standing, limit } = listQuery.parse(req.query);
    res.json(await listClients({ search: q, standing, limit }));
  },
);

// any Client, for the Office, with where each of their homes stands
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
