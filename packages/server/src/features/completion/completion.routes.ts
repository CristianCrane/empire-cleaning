import { Router, type Response } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { jobAssignedTo, officeJob } from "../assignments/assignments.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
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

const job = z.object({ id: z.uuid() });
const jobAdjustment = z.object({ id: z.uuid(), adjustmentId: z.uuid() });

type JobAdjustment = { id: string; adjustmentId: string };

// ---- the Cleaner: /api/assignments/mine/:id/complete ----

export const cleanerCompletionRouter = Router();

cleanerCompletionRouter.post(
  "/mine/:id/complete",
  authorize("cleaner"),
  validate({ params: job, body: completionSchema }),
  async (req, res) => {
    const member = await staffForAccount(signedInAccount(res).id);
    if (!member) throw new NotFoundError("Staff member not found");
    const jobId = String(req.params.id);
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
    const { id, adjustmentId } = req.params as JobAdjustment;
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
    const { id, adjustmentId } = req.params as JobAdjustment;
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
    const { id, adjustmentId } = req.params as JobAdjustment;
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
    const { id, adjustmentId } = req.params as JobAdjustment;
    await removeAdjustment(id, adjustmentId);
    res.json(await officeJob(id));
  },
);

officeCompletionRouter.patch(
  "/:id/completion",
  authorize("office_staff"),
  validate({ params: job, body: conditionSchema }),
  async (req, res) => {
    const id = String(req.params.id);
    await correctCondition(id, req.body.condition);
    res.json(await officeJob(id));
  },
);

// undoes a completion made by mistake
officeCompletionRouter.delete(
  "/:id/completion",
  authorize("office_staff"),
  validate({ params: job }),
  async (req, res) => {
    const id = String(req.params.id);
    await undoCompletion(id);
    res.json(await officeJob(id));
  },
);

officeCompletionRouter.post(
  "/:id/balance/retry",
  authorize("office_staff"),
  validate({ params: job }),
  async (req, res) => {
    const id = String(req.params.id);
    await retryBalance(id);
    res.json(await officeJob(id));
  },
);

// ---- the signed-in Client's own Jobs: /api/jobs/mine ----

export const clientJobsRouter = Router();

const ownClient = async (res: Response) => {
  const client = await clientForAccount(signedInAccount(res).id);
  if (!client) throw new NotFoundError("Client not found");
  return client;
};

// their Completed Jobs, latest first
clientJobsRouter.get("/mine/past", authorize("client"), async (req, res) => {
  res.json(await pastJobsFor((await ownClient(res)).id));
});

clientJobsRouter.get(
  "/mine/:id",
  authorize("client"),
  validate({ params: job }),
  async (req, res) => {
    res.json(await clientJob((await ownClient(res)).id, String(req.params.id)));
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
      const client = await ownClient(res);
      const { id, adjustmentId } = req.params as JobAdjustment;
      await answerAdjustment(client.id, id, adjustmentId, approve);
      res.json(await clientJob(client.id, id));
    },
  );
}

clientJobsRouter.post(
  "/mine/:id/balance/retry",
  authorize("client"),
  validate({ params: job }),
  async (req, res) => {
    const client = await ownClient(res);
    const id = String(req.params.id);
    await clientRetryBalance(client.id, id);
    res.json(await clientJob(client.id, id));
  },
);
