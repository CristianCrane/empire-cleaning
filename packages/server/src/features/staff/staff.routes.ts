import { Router } from "express";
import { z } from "zod";
import { byId, day, validate } from "../../middleware/validation.ts";
import { authorize } from "../auth/authorize.ts";
import {
  deactivateStaff,
  editStaff,
  inviteStaff,
  listStaff,
  removeException,
  setException,
  setUsualWeek,
  staffDetail,
} from "./staff.ts";
import {
  editStaffSchema,
  exceptionSchema,
  invitationSchema,
  usualWeekSchema,
} from "./staff.validation.ts";

export const router = Router();

// everything here is for Office Staff
router.use(authorize("office_staff"));

const memberDay = z.object({ id: z.uuid(), date: day });

router.get("/", async (_req, res) => {
  res.json(await listStaff());
});

router.post("/", validate({ body: invitationSchema }), async (req, res) => {
  res.status(201).json(await inviteStaff(req.body));
});

router.get("/:id", validate({ params: byId }), async (req, res) => {
  res.json(await staffDetail(req.params.id));
});

router.patch(
  "/:id",
  validate({ params: byId, body: editStaffSchema }),
  async (req, res) => {
    res.json(await editStaff(req.params.id, req.body));
  },
);

router.post("/:id/deactivate", validate({ params: byId }), async (req, res) => {
  res.json(await deactivateStaff(req.params.id));
});

router.put(
  "/:id/usual-week",
  validate({ params: byId, body: usualWeekSchema }),
  async (req, res) => {
    res.json(await setUsualWeek(req.params.id, req.body.usualWeek));
  },
);

router.put(
  "/:id/exceptions/:date",
  validate({ params: memberDay, body: exceptionSchema }),
  async (req, res) => {
    const { id, date } = req.params;
    res.json(await setException(id, { date, ...req.body }));
  },
);

router.delete(
  "/:id/exceptions/:date",
  validate({ params: memberDay }),
  async (req, res) => {
    const { id, date } = req.params;
    res.json(await removeException(id, date));
  },
);
