import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { jobAssignedTo, officeJob } from "../assignments/assignments.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
import { clientJob, ownJob } from "../completion/completion.ts";
import { staffForAccount } from "../staff/staff.ts";
import { cancelJob, recordNoAccess } from "./cancellation.ts";
import {
  cancelSchema,
  noAccessSchema,
  officeCancelSchema,
} from "./cancellation.validation.ts";

const job = z.object({ id: z.uuid() });

// ---- the signed-in Client: /api/jobs/mine/:id/cancel ----

export const clientCancellationRouter = Router();

clientCancellationRouter.post(
  "/mine/:id/cancel",
  authorize("client"),
  validate({ params: job, body: cancelSchema }),
  async (req, res) => {
    const account = signedInAccount(res);
    const client = await clientForAccount(account.id);
    if (!client) throw new NotFoundError("Client not found");
    const id = String(req.params.id);
    await ownJob(client.id, id);
    await cancelJob(id, {
      by: "client",
      feeCents: req.body.feeCents,
      reason: null,
      byAccountId: account.id,
      byClient: true,
    });
    res.json(await clientJob(client.id, id));
  },
);

// ---- Office Staff, for the Client or Empire Cleaning: /api/jobs/:id/cancel ----

export const officeCancellationRouter = Router();

officeCancellationRouter.post(
  "/:id/cancel",
  authorize("office_staff"),
  validate({ params: job, body: officeCancelSchema }),
  async (req, res) => {
    const id = String(req.params.id);
    await cancelJob(id, {
      by: req.body.by,
      feeCents: req.body.feeCents,
      reason: req.body.reason,
      byAccountId: signedInAccount(res).id,
      byClient: false,
    });
    res.json(await officeJob(id));
  },
);

// ---- the Cleaner: /api/assignments/mine/:id/no-access ----

export const noAccessRouter = Router();

noAccessRouter.post(
  "/mine/:id/no-access",
  authorize("cleaner"),
  validate({ params: job, body: noAccessSchema }),
  async (req, res) => {
    const member = await staffForAccount(signedInAccount(res).id);
    if (!member) throw new NotFoundError("Staff member not found");
    const id = String(req.params.id);
    await recordNoAccess(member.id, id, req.body.reason);
    res.json(await jobAssignedTo(member.id, id));
  },
);
