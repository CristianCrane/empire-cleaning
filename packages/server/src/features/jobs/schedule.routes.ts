import { Router } from "express";
import { validate } from "../../middleware/validation.ts";
import { atTime } from "../../services/clock/index.ts";
import { authorize } from "../auth/authorize.ts";
import { roomOn, startsWithoutCrew } from "./rules.ts";
import { roomFor, scheduleFor } from "./schedule.ts";
import {
  capacitySchema,
  rangeSchema,
  startsSchema,
} from "./schedule.validation.ts";

export const router = Router();

router.use(authorize("office_staff"));

// GET /api/schedule?from=2026-11-02&to=2026-11-08
router.get("/", validate({ query: rangeSchema }), async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  res.json(await scheduleFor(from, to));
});

// GET /api/schedule/capacity?date=2026-11-03&time=09:00&labourHours=4.5&crewSize=2
// (&jobId= for a booked Job being moved)
router.get(
  "/capacity",
  validate({ query: capacitySchema }),
  async (req, res) => {
    const { date, time, ...clean } = capacitySchema.parse(req.query);
    res.json(await roomFor({ startsAt: atTime(date, time), ...clean }));
  },
);

// GET /api/schedule/starts?from=2026-11-02&to=2026-11-08&labourHours=4.5&crewSize=2
// (&jobId= or &siteVisitId= for one being moved): the starts on those days
// without a crew free for the clean, as the pickers mark them
router.get("/starts", validate({ query: startsSchema }), async (req, res) => {
  const { from, to, ...clean } = startsSchema.parse(req.query);
  res.json(
    startsWithoutCrew(
      await scheduleFor(from, to),
      (day, startsAt) => roomOn(day, { ...clean, startsAt }).hasCrew,
    ),
  );
});
