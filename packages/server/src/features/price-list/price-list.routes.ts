import { currentLanguage } from "#services/request";
import { Router } from "express";
import { z } from "zod";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { validate } from "../../middleware/validation.ts";
import { serviceKey } from "../quotes/asking.validation.ts";
import {
  choosableAddOns,
  choosablePremisesTypes,
  currentPriceList,
  savePriceList,
} from "./price-list.ts";
import { priceListSchema } from "./price-list.validation.ts";

export const router = Router();

// the names a Client can pick as Add-ons for a Service (?service=<key>),
// never their prices; open to Guests because the landing page's "Request a
// Quote" form lists them
router.get(
  "/add-ons",
  validate({ query: z.object({ service: serviceKey }) }),
  async (req, res) => {
    res.json(await choosableAddOns(req.query.service, currentLanguage()));
  },
);

// the Premises Types business premises can be described as, by name; open
// to Guests for the same reason
router.get("/premises-types", async (_req, res) => {
  res.json(await choosablePremisesTypes(currentLanguage()));
});

router.get("/", authorize("office_staff"), async (_req, res) => {
  res.json(await currentPriceList());
});

// every save is a new version; changes only affect prices worked out from now
router.put(
  "/",
  authorize("office_staff"),
  validate({ body: priceListSchema }),
  async (req, res) => {
    res.json(await savePriceList(req.body, signedInAccount(res).id));
  },
);
