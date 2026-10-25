import { Router } from "express";
import { validate } from "../../middleware/validation.ts";
import { authorize } from "../auth/authorize.ts";
import { hasRoomFor, scheduleFor } from "./schedule.ts";
import { capacitySchema, rangeSchema } from "./schedule.validation.ts";

export const router = Router();

router.use(authorize("office_staff"));

// GET /api/schedule?from=2026-11-02&to=2026-11-08
router.get("/", validate({ query: rangeSchema }), async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  res.json(await scheduleFor(from, to));
});

// GET /api/schedule/capacity?date=2026-11-03&labourHours=4.5
router.get(
  "/capacity",
  validate({ query: capacitySchema }),
  async (req, res) => {
    const { date, labourHours } = capacitySchema.parse(req.query);
    res.json(await hasRoomFor(date, labourHours));
  },
);
