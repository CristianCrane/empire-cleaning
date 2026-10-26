import { Router } from "express";
import { z } from "zod";
import { NotFoundError } from "../../middleware/errors.ts";
import { validate } from "../../middleware/validation.ts";
import {
  authorize,
  currentAccount,
  signedInAccount,
} from "../auth/authorize.ts";
import { startDraft } from "../quotes/quotes.ts";
import {
  enterQuoteRequest,
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

// Office Staff entering a caller's request, and starting its Quote Draft
// straight away (#34)
router.post("/office", authorize("office_staff"), async (req, res) => {
  const { id } = signedInAccount(res);
  const request = await enterQuoteRequest(id, req.body);
  const { quote } = await startDraft(
    { quoteRequestId: request.id, kind: "one_off" },
    id,
  );
  res.status(201).json({ quoteRequestId: request.id, quoteId: quote.id });
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
