import { Router } from "express";
import { z } from "zod";
import type { Me } from "@empire-cleaning/models";
import { language, validate } from "../../middleware/validation.ts";
import { toursSeenBy } from "../tours/tours.ts";
import { authorize, signedInAccount } from "./authorize.ts";
import { languagesOfAccount, setOwnLanguage } from "./language.ts";

export const router = Router();

// the signed-in Account; the web app uses this to pick the area to show, its
// language, and which first-time help tours to skip
router.get("/", authorize(), async (_req, res) => {
  const { id, email, name, roles } = signedInAccount(res);
  const me: Me = {
    id,
    email,
    name,
    roles,
    seenTours: await toursSeenBy(id),
    languages: await languagesOfAccount(id),
  };
  res.json(me);
});

// the person's own choice of language, for every record they are (ADR-0025)
router.put(
  "/language",
  authorize(),
  validate({ body: z.object({ language }) }),
  async (req, res) => {
    await setOwnLanguage(signedInAccount(res).id, req.body.language);
    res.status(204).end();
  },
);
