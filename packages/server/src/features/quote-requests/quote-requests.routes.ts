import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import { authorize, currentAccount } from "../auth/authorize.ts";
import {
  openQuoteRequests,
  quoteRequestDetail,
  submitQuoteRequest,
} from "./quote-requests.ts";

export const router = Router();

// open to Guests (the landing page) and signed-in Accounts (the portal)
router.post("/", async (req, res) => {
  const receipt = await submitQuoteRequest(await currentAccount(req), req.body);
  res.status(201).json(receipt);
});

router.get("/", authorize("office_staff"), async (req, res) => {
  res.json(await openQuoteRequests());
});

router.get(
  "/:id",
  authorize("office_staff"),
  validate({ params: z.object({ id: z.uuid() }) }),
  async (req, res) => {
    const detail = await quoteRequestDetail(String(req.params.id));
    if (!detail) throw new NotFoundError("Quote Request not found");
    res.json(detail);
  },
);
