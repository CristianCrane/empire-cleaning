import { Router } from "express";
import { z } from "zod";
import { authorize, signedInAccount } from "../auth/authorize.ts";
import { validate } from "../../middleware/validation.ts";
import {
  createService,
  currentServices,
  findService,
  saveService,
  servicesOnOffer,
} from "./services.ts";
import { serviceSchema } from "./services.validation.ts";

export const router = Router();

const params = z.object({ key: z.uuid() });

// the Services a Quote can be asked for now; open to Guests because the
// landing page's "Request a Quote" form lists them
router.get("/on-offer", async (req, res) => {
  res.json(await servicesOnOffer());
});

// every Service, active and retired, for the Office
router.get("/", authorize("office_staff"), async (req, res) => {
  res.json(await currentServices());
});

router.get(
  "/:key",
  authorize("office_staff"),
  validate({ params }),
  async (req, res) => {
    res.json(await findService(String(req.params.key)));
  },
);

router.post(
  "/",
  authorize("office_staff"),
  validate({ body: serviceSchema }),
  async (req, res) => {
    res
      .status(201)
      .json(await createService(req.body, signedInAccount(res).id));
  },
);

// every save is a new version; changes only affect prices worked out from now
router.put(
  "/:key",
  authorize("office_staff"),
  validate({ params, body: serviceSchema }),
  async (req, res) => {
    res.json(
      await saveService(
        String(req.params.key),
        req.body,
        signedInAccount(res).id,
      ),
    );
  },
);
