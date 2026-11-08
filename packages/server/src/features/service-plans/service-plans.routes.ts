import { Router } from "express";
import { z } from "zod";
import { day, startTime, validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { ownClient } from "../clients/clients.ts";
import { endServicePlan } from "./ending.ts";
import {
  bookVisit,
  clientEndServicePlan,
  clientServicePlan,
  clientServicePlans,
  officeServicePlan,
  skipVisit,
} from "./service-plans.ts";

export const router = Router();

const plan = z.object({ id: z.uuid() });
const visit = z.object({ id: z.uuid(), visitId: z.uuid() });

// a time Office Staff book an unplaced visit at, New York
const bookVisitSchema = z.object({
  date: day,
  time: startTime,
});

// Ending a plan: the Jobs going ahead that the person Ending it was shown,
// by when they start
const endSchema = z.object({ goingAhead: z.array(z.iso.datetime()) });

// ---- the signed-in Client: /api/service-plans/mine ----

router.get("/mine", authorize("client"), async (_req, res) => {
  const client = await ownClient(signedInAccount(res).id);
  res.json(await clientServicePlans(client.id));
});

router.get(
  "/mine/:id",
  authorize("client"),
  validate({ params: plan }),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    res.json(await clientServicePlan(client.id, String(req.params.id)));
  },
);

router.post(
  "/mine/:id/end",
  authorize("client"),
  validate({ params: plan, body: endSchema }),
  async (req, res) => {
    const account = signedInAccount(res);
    const client = await ownClient(account.id);
    res.json(
      await clientEndServicePlan(client.id, String(req.params.id), {
        goingAhead: req.body.goingAhead,
        byAccountId: account.id,
        byClient: true,
      }),
    );
  },
);

// ---- the Office ----

router.get(
  "/:id",
  authorize("office_staff"),
  validate({ params: plan }),
  async (req, res) => {
    res.json(await officeServicePlan(String(req.params.id)));
  },
);

// Office Staff End a plan for its Client
router.post(
  "/:id/end",
  authorize("office_staff"),
  validate({ params: plan, body: endSchema }),
  async (req, res) => {
    const id = String(req.params.id);
    await endServicePlan(id, {
      goingAhead: req.body.goingAhead,
      byAccountId: signedInAccount(res).id,
      byClient: false,
    });
    res.json(await officeServicePlan(id));
  },
);

router.post(
  "/:id/visits/:visitId/book",
  authorize("office_staff"),
  validate({ params: visit, body: bookVisitSchema }),
  async (req, res) => {
    res.json(
      await bookVisit(
        String(req.params.id),
        String(req.params.visitId),
        req.body,
      ),
    );
  },
);

router.post(
  "/:id/visits/:visitId/skip",
  authorize("office_staff"),
  validate({ params: visit }),
  async (req, res) => {
    res.json(
      await skipVisit(String(req.params.id), String(req.params.visitId)),
    );
  },
);
