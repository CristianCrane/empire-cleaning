import { Router } from "express";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { validate } from "../../middleware/validation.ts";
import {
  choosableAddOns,
  choosablePremisesTypes,
  currentPriceList,
  savePriceList,
} from "./price-list.ts";
import { priceListSchema } from "./price-list.validation.ts";

export const router = Router();

// the names a Client can pick as Add-ons, never their prices; open to Guests
// because the landing page's "Request a Quote" form lists them
router.get("/add-ons", async (req, res) => {
  res.json(await choosableAddOns());
});

// the Premises Types business premises can be described as, by name; open
// to Guests for the same reason
router.get("/premises-types", async (req, res) => {
  res.json(await choosablePremisesTypes());
});

router.get("/", authorize("office_staff"), async (req, res) => {
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
