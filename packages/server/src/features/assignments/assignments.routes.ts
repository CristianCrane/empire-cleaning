import { Router, type Response } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { staffForAccount } from "../staff/staff.ts";
import {
  confirmAssignment,
  jobAssignedTo,
  jobsAssignedTo,
  offerAssignment,
  officeJob,
  releaseAssignment,
  removeAssignment,
} from "./assignments.ts";

const job = z.object({ id: z.uuid() });
const jobAssignment = z.object({ id: z.uuid(), assignmentId: z.uuid() });
const offerSchema = z.object({ staffId: z.uuid("Choose a Cleaner") });

// ---- Office Staff, on a Job: /api/jobs/:id ----

export const jobAssignmentsRouter = Router();

jobAssignmentsRouter.get(
  "/:id",
  authorize("office_staff"),
  validate({ params: job }),
  async (req, res) => {
    res.json(await officeJob(String(req.params.id)));
  },
);

jobAssignmentsRouter.post(
  "/:id/assignments",
  authorize("office_staff"),
  validate({ params: job, body: offerSchema }),
  async (req, res) => {
    res
      .status(201)
      .json(
        await offerAssignment(
          String(req.params.id),
          req.body.staffId,
          signedInAccount(res).id,
        ),
      );
  },
);

jobAssignmentsRouter.delete(
  "/:id/assignments/:assignmentId",
  authorize("office_staff"),
  validate({ params: jobAssignment }),
  async (req, res) => {
    const { id, assignmentId } = req.params as {
      id: string;
      assignmentId: string;
    };
    res.json(await removeAssignment(id, assignmentId, signedInAccount(res).id));
  },
);

// ---- Cleaners, their own: /api/assignments ----

export const router = Router();

router.use(authorize("cleaner"));

// the signed-in Cleaner's Staff record
const cleaner = async (res: Response) => {
  const member = await staffForAccount(signedInAccount(res).id);
  if (!member) throw new NotFoundError("Staff member not found");
  return member;
};

const assignment = z.object({ id: z.uuid() });

// their Jobs today and to come, soonest first
router.get("/mine", async (req, res) => {
  res.json(await jobsAssignedTo((await cleaner(res)).id));
});

router.get("/mine/:id", validate({ params: job }), async (req, res) => {
  res.json(await jobAssignedTo((await cleaner(res)).id, String(req.params.id)));
});

router.post(
  "/:id/confirm",
  validate({ params: assignment }),
  async (req, res) => {
    res.json(
      await confirmAssignment((await cleaner(res)).id, String(req.params.id)),
    );
  },
);

router.post(
  "/:id/release",
  validate({ params: assignment }),
  async (req, res) => {
    await releaseAssignment((await cleaner(res)).id, String(req.params.id));
    res.status(204).end();
  },
);
