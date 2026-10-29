import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
import { validate } from "../../middleware/validation.ts";
import { upcomingJobsFor } from "./jobs.ts";
import { jobsTabs, listJobs } from "./list.ts";

export const jobsRouter = Router();

// the signed-in Client's booked Jobs still to come, soonest first
jobsRouter.get("/mine", authorize("client"), async (req, res) => {
  const client = await clientForAccount(signedInAccount(res).id);
  if (!client) throw new NotFoundError("Client not found");
  res.json(await upcomingJobsFor(client.id));
});

const listQuery = z.object({
  q: z.string().optional(),
  tab: z.enum([...jobsTabs, "all"]).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

// a page of the Office's Jobs: those matching ?q=, under ?tab= (or any), the
// first ?limit= of them (see listJobs)
jobsRouter.get(
  "/",
  authorize("office_staff"),
  validate({ query: listQuery }),
  async (req, res) => {
    const { q, tab, limit } = listQuery.parse(req.query);
    res.json(await listJobs({ search: q, tab, limit }));
  },
);
