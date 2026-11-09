import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.ts";
import {
  fieldError,
  NotFoundError,
  RequestBodyError,
} from "../../middleware/errors.ts";
import { byId, keepUnder, validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clients } from "../clients/clients.schema.ts";
import {
  currentPriceList,
  NOT_A_PREMISES_TYPE,
  offersPremisesType,
} from "../price-list/price-list.ts";
import {
  checkRooms,
  homeCorrectionSchema,
  premisesCorrectionSchema,
} from "../quotes/asking.validation.ts";
import { properties } from "./properties.schema.ts";
import { officePropertyView } from "./property-history.ts";
import { toPropertyView } from "./property-view.ts";

export const router = Router();

// any Property, for the Office, with its whole history
router.get(
  "/:id",
  authorize("office_staff"),
  validate({ params: byId }),
  async (req, res) => {
    const view = await officePropertyView(req.params.id);
    if (!view) throw new NotFoundError("Property not found");
    res.json(view);
  },
);

// Access Instructions are the Client's to maintain (Office Staff may too);
// a Client can only reach their own Properties
router.patch(
  "/:id/access-instructions",
  authorize("client", "office_staff"),
  validate({
    params: byId,
    body: z.object({
      accessInstructions: z
        .string()
        .trim()
        .max(2000, keepUnder(2000))
        .nullable(),
    }),
  }),
  async (req, res) => {
    const account = signedInAccount(res);
    const id = req.params.id;
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
// keeps the details they first gave, and asks for a new Quote to change them.
// A home's are its rooms; business premises' their Premises Type (one on
// offer, or the one they have) and floor area. Either's Condition.
// A home whose rooms aren't known yet gets them all together.
router.patch(
  "/:id",
  authorize("office_staff"),
  validate({ params: byId }),
  async (req, res) => {
    const id = req.params.id;
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, id));
    if (!property) throw new NotFoundError("Property not found");

    const list = await currentPriceList();
    let changes;
    if (property.kind === "commercial") {
      const parsed = premisesCorrectionSchema.safeParse(req.body);
      if (!parsed.success) throw new RequestBodyError(parsed.error);
      const { premisesType, ...rest } = parsed.data;
      if (
        premisesType !== undefined &&
        premisesType !== property.premisesTypeKey &&
        !offersPremisesType(list, premisesType)
      ) {
        throw fieldError(["premisesType"], NOT_A_PREMISES_TYPE, premisesType);
      }
      changes = { ...rest, premisesTypeKey: premisesType };
    } else {
      const parsed = homeCorrectionSchema.safeParse(req.body);
      if (!parsed.success) throw new RequestBodyError(parsed.error);
      // a home without its rooms is given all four at once
      const problems =
        property.bedrooms === null
          ? checkRooms(parsed.data, { needed: false, at: [] })
          : [];
      if (problems.length > 0)
        throw new RequestBodyError(new z.ZodError(problems));
      changes = parsed.data;
    }

    const [updated] = await db
      .update(properties)
      .set(changes)
      .where(eq(properties.id, id))
      .returning();
    res.json(toPropertyView(updated!, list));
  },
);
