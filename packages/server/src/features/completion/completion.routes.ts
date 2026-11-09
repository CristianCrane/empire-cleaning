import { Router } from "express";
import { z } from "zod";
import { byId, validate } from "../../middleware/validation.ts";
import { jobAssignedTo, officeJob } from "../assignments/assignments.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { ownClient } from "../clients/clients.ts";
import { staffForAccount } from "../staff/staff.ts";
import {
  answerAdjustment,
  clientJob,
  clientRetryBalance,
  completeJob,
  correctAdjustment,
  correctCondition,
  dismissAdjustment,
  pastJobsFor,
  proposeAdjustment,
  removeAdjustment,
  retryBalance,
  undoCompletion,
} from "./completion.ts";
import {
  completionSchema,
  conditionSchema,
  correctionSchema,
  dismissalSchema,
  proposalSchema,
} from "./completion.validation.ts";

const jobAdjustment = z.object({ id: z.uuid(), adjustmentId: z.uuid() });

// ---- the Cleaner: /api/assignments/mine/:id/complete ----

export const cleanerCompletionRouter = Router();

cleanerCompletionRouter.post(
  "/mine/:id/complete",
  authorize("cleaner"),
  validate({ params: byId, body: completionSchema }),
  async (req, res) => {
    const member = await staffForAccount(signedInAccount(res).id);
    const jobId = req.params.id;
    await completeJob(member.id, jobId, req.body);
    res.json(await jobAssignedTo(member.id, jobId));
  },
);

// ---- Office Staff, on a Completed Job: /api/jobs/:id ----

export const officeCompletionRouter = Router();

officeCompletionRouter.post(
  "/:id/adjustments/:adjustmentId/propose",
  authorize("office_staff"),
  validate({ params: jobAdjustment, body: proposalSchema }),
  async (req, res) => {
    const { id, adjustmentId } = req.params;
    await proposeAdjustment(
      id,
      adjustmentId,
      req.body,
      signedInAccount(res).id,
    );
    res.json(await officeJob(id));
  },
);

officeCompletionRouter.post(
  "/:id/adjustments/:adjustmentId/dismiss",
  authorize("office_staff"),
  validate({ params: jobAdjustment, body: dismissalSchema }),
  async (req, res) => {
    const { id, adjustmentId } = req.params;
    await dismissAdjustment(
      id,
      adjustmentId,
      req.body.reason ?? null,
      signedInAccount(res).id,
    );
    res.json(await officeJob(id));
  },
);

officeCompletionRouter.patch(
  "/:id/adjustments/:adjustmentId",
  authorize("office_staff"),
  validate({ params: jobAdjustment, body: correctionSchema }),
  async (req, res) => {
    const { id, adjustmentId } = req.params;
    await correctAdjustment(
      id,
      adjustmentId,
      req.body,
      signedInAccount(res).id,
    );
    res.json(await officeJob(id));
  },
);

officeCompletionRouter.delete(
  "/:id/adjustments/:adjustmentId",
  authorize("office_staff"),
  validate({ params: jobAdjustment }),
  async (req, res) => {
    const { id, adjustmentId } = req.params;
    await removeAdjustment(id, adjustmentId);
    res.json(await officeJob(id));
  },
);

officeCompletionRouter.patch(
  "/:id/completion",
  authorize("office_staff"),
  validate({ params: byId, body: conditionSchema }),
  async (req, res) => {
    const id = req.params.id;
    await correctCondition(id, req.body.condition);
    res.json(await officeJob(id));
  },
);

// undoes a completion made by mistake
officeCompletionRouter.delete(
  "/:id/completion",
  authorize("office_staff"),
  validate({ params: byId }),
  async (req, res) => {
    const id = req.params.id;
    await undoCompletion(id);
    res.json(await officeJob(id));
  },
);

officeCompletionRouter.post(
  "/:id/balance/retry",
  authorize("office_staff"),
  validate({ params: byId }),
  async (req, res) => {
    const id = req.params.id;
    await retryBalance(id);
    res.json(await officeJob(id));
  },
);

// ---- the signed-in Client's own Jobs: /api/jobs/mine ----

export const clientJobsRouter = Router();

// their Completed Jobs, latest first
clientJobsRouter.get("/mine/past", authorize("client"), async (_req, res) => {
  res.json(await pastJobsFor((await ownClient(signedInAccount(res).id)).id));
});

clientJobsRouter.get(
  "/mine/:id",
  authorize("client"),
  validate({ params: byId }),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    res.json(await clientJob(client.id, req.params.id));
  },
);

for (const [answer, approve] of [
  ["approve", true],
  ["decline", false],
] as const) {
  clientJobsRouter.post(
    `/mine/:id/adjustments/:adjustmentId/${answer}`,
    authorize("client"),
    validate({ params: jobAdjustment }),
    async (req, res) => {
      const client = await ownClient(signedInAccount(res).id);
      const { id, adjustmentId } = req.params;
      await answerAdjustment(client.id, id, adjustmentId, approve);
      res.json(await clientJob(client.id, id));
    },
  );
}

clientJobsRouter.post(
  "/mine/:id/balance/retry",
  authorize("client"),
  validate({ params: byId }),
  async (req, res) => {
    const client = await ownClient(signedInAccount(res).id);
    const id = req.params.id;
    await clientRetryBalance(client.id, id);
    res.json(await clientJob(client.id, id));
  },
);
