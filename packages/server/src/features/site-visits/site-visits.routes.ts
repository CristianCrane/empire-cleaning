import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
import { staffForAccount } from "../staff/staff.ts";
import {
  bookSiteVisit,
  cancelSiteVisit,
  clientSiteVisits,
  moveSiteVisit,
  officeSiteVisit,
  recordFindings,
  recordFindingsWithoutVisit,
  visitsFor,
} from "./site-visits.ts";
import { bookingSchema, newVisitSchema } from "./site-visits.validation.ts";

export const router = Router();

const params = z.object({ id: z.uuid() });

// ---- the Client's and the visitor's own ----

// the signed-in Client's booked Site Visits from today on; they ask for
// changes by phone
router.get("/mine", authorize("client"), async (req, res) => {
  const client = await clientForAccount(signedInAccount(res).id);
  if (!client) throw new NotFoundError("Client not found");
  res.json(await clientSiteVisits(client.id));
});

// the signed-in Cleaner's own Site Visits, today's and those to come
router.get("/visiting", authorize("cleaner"), async (req, res) => {
  const member = await staffForAccount(signedInAccount(res).id);
  if (!member) throw new NotFoundError("Staff member not found");
  res.json(await visitsFor(member.id));
});

// ---- Office Staff ----

router.post(
  "/",
  authorize("office_staff"),
  validate({ body: newVisitSchema }),
  async (req, res) => {
    const input = newVisitSchema.parse(req.body);
    res.status(201).json(await bookSiteVisit(input, signedInAccount(res).id));
  },
);

router.get(
  "/:id",
  authorize("office_staff"),
  validate({ params }),
  async (req, res) => {
    res.json(await officeSiteVisit(String(req.params.id)));
  },
);

router.post(
  "/:id/move",
  authorize("office_staff"),
  validate({ params, body: bookingSchema }),
  async (req, res) => {
    const input = bookingSchema.parse(req.body);
    res.json(await moveSiteVisit(String(req.params.id), input));
  },
);

router.post(
  "/:id/cancel",
  authorize("office_staff"),
  validate({ params }),
  async (req, res) => {
    res.json(
      await cancelSiteVisit(String(req.params.id), signedInAccount(res).id),
    );
  },
);

// what it found, for the Property's kind (checked there): it's Done
router.post(
  "/:id/findings",
  authorize("office_staff"),
  validate({ params }),
  async (req, res) => {
    res.json(
      await recordFindings(
        String(req.params.id),
        req.body,
        signedInAccount(res).id,
      ),
    );
  },
);

// ---- /api/properties/:id/findings: findings with no visit ----

export const propertyFindingsRouter = Router();

// for premises the Office knows already, such as an existing Client's
propertyFindingsRouter.post(
  "/:id/findings",
  authorize("office_staff"),
  validate({ params }),
  async (req, res) => {
    res
      .status(201)
      .json(
        await recordFindingsWithoutVisit(
          String(req.params.id),
          req.body,
          signedInAccount(res).id,
        ),
      );
  },
);
