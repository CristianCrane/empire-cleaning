import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validation.ts";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { forgetToursSeen, markTourSeen } from "./tours.ts";

// /api/me/tours: the signed-in Account's own first-time help tours, for any
// area. GET /api/me lists the ones seen (seenTours)
export const router = Router();

router.use(authorize());

// the web app names its tours; a short slug, so a new one needs nothing here
const tourParams = z.object({ tour: z.string().regex(/^[a-z0-9-]{1,40}$/) });

router.put("/:tour", validate({ params: tourParams }), async (req, res) => {
  await markTourSeen(signedInAccount(res).id, req.params.tour);
  res.status(204).end();
});

router.delete("/", async (_req, res) => {
  await forgetToursSeen(signedInAccount(res).id);
  res.status(204).end();
});
