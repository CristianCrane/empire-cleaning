import { Router } from "express";
import { NotFoundError } from "../../middleware/errors.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { clientForAccount } from "../clients/clients.ts";
import { upcomingJobsFor } from "./jobs.ts";

export const jobsRouter = Router();

// the signed-in Client's booked Jobs still to come, soonest first
jobsRouter.get("/mine", authorize("client"), async (req, res) => {
  const client = await clientForAccount(signedInAccount(res).id);
  if (!client) throw new NotFoundError("Client not found");
  res.json(await upcomingJobsFor(client.id));
});
