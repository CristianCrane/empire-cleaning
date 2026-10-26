import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/index.ts";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { officeJob } from "../assignments/assignments.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
import { clientJob, ownJob } from "../completion/completion.ts";
import { jobs } from "../jobs/jobs.schema.ts";
import {
  confirmReschedule,
  requestReschedule,
  rescheduleTimesFor,
  turnDownReschedule,
  withdrawReschedule,
} from "./reschedule.ts";
import { rescheduleSchema, turnDownSchema } from "./reschedule.validation.ts";

const job = z.object({ id: z.uuid() });

// ---- the signed-in Client: /api/jobs/mine/:id/reschedule-... ----

export const clientRescheduleRouter = Router();

// the signed-in Client's own Job; to anyone else it doesn't exist
const mine = async (accountId: string, jobId: string) => {
  const client = await clientForAccount(accountId);
  if (!client) throw new NotFoundError("Client not found");
  const { job } = await ownJob(client.id, jobId);
  return { client, job };
};

clientRescheduleRouter.get(
  "/mine/:id/reschedule-times",
  authorize("client"),
  validate({ params: job }),
  async (req, res) => {
    const { job } = await mine(signedInAccount(res).id, String(req.params.id));
    res.json(await rescheduleTimesFor(job));
  },
);

clientRescheduleRouter.post(
  "/mine/:id/reschedule-request",
  authorize("client"),
  validate({ params: job, body: rescheduleSchema }),
  async (req, res) => {
    const account = signedInAccount(res);
    const id = String(req.params.id);
    const { client } = await mine(account.id, id);
    const { date, time, cost } = req.body;
    await requestReschedule(
      id,
      { date, time },
      { cost, byAccountId: account.id, byClient: true },
    );
    res.status(201).json(await clientJob(client.id, id));
  },
);

clientRescheduleRouter.post(
  "/mine/:id/reschedule-request/withdraw",
  authorize("client"),
  validate({ params: job }),
  async (req, res) => {
    const account = signedInAccount(res);
    const id = String(req.params.id);
    const { client } = await mine(account.id, id);
    await withdrawReschedule(id, account.id);
    res.json(await clientJob(client.id, id));
  },
);

// ---- Office Staff: /api/jobs/:id/reschedule-... ----

export const officeRescheduleRouter = Router();

const jobById = async (jobId: string) => {
  const [found] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!found) throw new NotFoundError("Job not found");
  return found;
};

officeRescheduleRouter.get(
  "/:id/reschedule-times",
  authorize("office_staff"),
  validate({ params: job }),
  async (req, res) => {
    res.json(await rescheduleTimesFor(await jobById(String(req.params.id))));
  },
);

// on the Client's behalf, e.g. by phone
officeRescheduleRouter.post(
  "/:id/reschedule-request",
  authorize("office_staff"),
  validate({ params: job, body: rescheduleSchema }),
  async (req, res) => {
    const id = String(req.params.id);
    const { date, time, cost } = req.body;
    await requestReschedule(
      id,
      { date, time },
      { cost, byAccountId: signedInAccount(res).id, byClient: false },
    );
    res.status(201).json(await officeJob(id));
  },
);

officeRescheduleRouter.post(
  "/:id/reschedule-request/confirm",
  authorize("office_staff"),
  validate({ params: job }),
  async (req, res) => {
    const id = String(req.params.id);
    await confirmReschedule(id, signedInAccount(res).id);
    res.json(await officeJob(id));
  },
);

officeRescheduleRouter.post(
  "/:id/reschedule-request/turn-down",
  authorize("office_staff"),
  validate({ params: job, body: turnDownSchema }),
  async (req, res) => {
    const id = String(req.params.id);
    await turnDownReschedule(id, req.body.reason, signedInAccount(res).id);
    res.json(await officeJob(id));
  },
);
