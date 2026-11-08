import { Router, type Response } from "express";
import { z } from "zod";
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
import {
  confirmCleanerNeeded,
  cleanerNeededFor,
  cleanersNeededFor,
  passCleanerNeeded,
} from "./cleaners-needed.ts";

const job = z.object({ id: z.uuid() });
const jobAssignment = z.object({ id: z.uuid(), assignmentId: z.uuid() });
const offerSchema = z.object({ staffId: z.uuid("Pick a cleaner") });

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
const cleaner = (res: Response) => staffForAccount(signedInAccount(res).id);

const assignment = z.object({ id: z.uuid() });
// the Job's time the Cleaner was shown, so a Job moved meanwhile isn't
// taken at a time they never saw (#242)
const seenSchema = z.object({ startsAt: z.iso.datetime() });

// their Jobs today and to come, soonest first
router.get("/mine", async (_req, res) => {
  res.json(await jobsAssignedTo((await cleaner(res)).id));
});

router.get("/mine/:id", validate({ params: job }), async (req, res) => {
  res.json(await jobAssignedTo((await cleaner(res)).id, String(req.params.id)));
});

// Cleaners Needed open to them (ADR-0019), soonest first; one, by its Job; and
// taking one, or saying it's "Not for me"
router.get("/open", async (_req, res) => {
  res.json(await cleanersNeededFor((await cleaner(res)).id));
});

router.get("/open/:id", validate({ params: job }), async (req, res) => {
  res.json(
    await cleanerNeededFor((await cleaner(res)).id, String(req.params.id)),
  );
});

router.post(
  "/open/:id/confirm",
  validate({ params: job, body: seenSchema }),
  async (req, res) => {
    const { id } = await cleaner(res);
    await confirmCleanerNeeded(
      id,
      String(req.params.id),
      new Date(req.body.startsAt),
    );
    res.json(await jobAssignedTo(id, String(req.params.id)));
  },
);

router.post("/open/:id/pass", validate({ params: job }), async (req, res) => {
  await passCleanerNeeded((await cleaner(res)).id, String(req.params.id));
  res.status(204).end();
});

router.post(
  "/:id/confirm",
  validate({ params: assignment, body: seenSchema }),
  async (req, res) => {
    res.json(
      await confirmAssignment(
        (await cleaner(res)).id,
        String(req.params.id),
        new Date(req.body.startsAt),
      ),
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
