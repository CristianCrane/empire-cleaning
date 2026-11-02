import { Router } from "express";
import env from "../../env.ts";
import { NotFoundError } from "../../middleware/errors.ts";
import { demoPeople } from "./demo-people.ts";

export const router = Router();

// GET /api/demo-people: for anyone, signed in or not, so a tester can pick
// who to be; never on the real site, whose people are real
router.get("/", async (_req, res) => {
  if (env.APP_MODE === "prod") throw new NotFoundError();
  res.json(await demoPeople());
});
