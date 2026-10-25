import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validation.ts";
import { authorize } from "../auth/authorize.ts";
import {
  deactivateStaff,
  inviteStaff,
  listStaff,
  removeException,
  setException,
  setUsualWeek,
  staffDetail,
} from "./staff.ts";
import {
  exceptionSchema,
  invitationSchema,
  isoDate,
  usualWeekSchema,
} from "./staff.validation.ts";

export const router = Router();

// everything here is for Office Staff
router.use(authorize("office_staff"));

const member = z.object({ id: z.uuid() });
const memberDay = z.object({ id: z.uuid(), date: isoDate });

router.get("/", async (req, res) => {
  res.json(await listStaff());
});

router.post("/", validate({ body: invitationSchema }), async (req, res) => {
  res.status(201).json(await inviteStaff(req.body));
});

router.get("/:id", validate({ params: member }), async (req, res) => {
  res.json(await staffDetail(String(req.params.id)));
});

router.post(
  "/:id/deactivate",
  validate({ params: member }),
  async (req, res) => {
    res.json(await deactivateStaff(String(req.params.id)));
  },
);

router.put(
  "/:id/usual-week",
  validate({ params: member, body: usualWeekSchema }),
  async (req, res) => {
    res.json(await setUsualWeek(String(req.params.id), req.body.usualWeek));
  },
);

router.put(
  "/:id/exceptions/:date",
  validate({ params: memberDay, body: exceptionSchema }),
  async (req, res) => {
    const { id, date } = req.params as { id: string; date: string };
    res.json(await setException(id, { date, ...req.body }));
  },
);

router.delete(
  "/:id/exceptions/:date",
  validate({ params: memberDay }),
  async (req, res) => {
    const { id, date } = req.params as { id: string; date: string };
    res.json(await removeException(id, date));
  },
);
