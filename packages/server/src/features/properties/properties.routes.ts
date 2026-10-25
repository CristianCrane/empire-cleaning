import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.ts";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clients } from "../clients/clients.schema.ts";
import { propertyCorrectionSchema } from "../quote-requests/quote-requests.validation.ts";
import { properties } from "./properties.schema.ts";

export const router = Router();

const params = z.object({ id: z.uuid() });

// Access Instructions are the Client's to maintain (Office Staff may too);
// a Client can only reach their own Properties
router.patch(
  "/:id/access-instructions",
  authorize("client", "office_staff"),
  validate({
    params,
    body: z.object({
      accessInstructions: z.string().trim().max(2000).nullable(),
    }),
  }),
  async (req, res) => {
    const account = signedInAccount(res);
    const id = String(req.params.id);
    const owned = account.roles.includes("office_staff")
      ? eq(properties.id, id)
      : and(
          eq(properties.id, id),
          eq(
            properties.clientId,
            db
              .select({ id: clients.id })
              .from(clients)
              .where(eq(clients.accountId, account.id)),
          ),
        );

    const [updated] = await db
      .update(properties)
      .set({ accessInstructions: req.body.accessInstructions || null })
      .where(owned)
      .returning({ id: properties.id });
    if (!updated) throw new NotFoundError("Property not found");
    res.json({
      id: updated.id,
      accessInstructions: req.body.accessInstructions || null,
    });
  },
);

// price-affecting, so the Office's to correct, never the Client's: a Client
// keeps the details they first gave, and asks for a new Quote to change them
router.patch(
  "/:id",
  authorize("office_staff"),
  validate({ params, body: propertyCorrectionSchema }),
  async (req, res) => {
    const [updated] = await db
      .update(properties)
      .set(req.body)
      .where(eq(properties.id, String(req.params.id)))
      .returning();
    if (!updated) throw new NotFoundError("Property not found");
    res.json(updated);
  },
);
