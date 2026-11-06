import { Router } from "express";
import type { Me } from "@empire-cleaning/models";
import { toursSeenBy } from "../tours/tours.ts";
import { authorize, signedInAccount } from "./authorize.ts";

export const router = Router();

// the signed-in Account; the web app uses this to pick the area to show, and
// which first-time help tours to skip
router.get("/", authorize(), async (_req, res) => {
  const { id, email, name, roles } = signedInAccount(res);
  const me: Me = { id, email, name, roles, seenTours: await toursSeenBy(id) };
  res.json(me);
});
