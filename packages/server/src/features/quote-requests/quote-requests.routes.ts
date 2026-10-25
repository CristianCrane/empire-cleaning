import { Router } from "express";
import { authorize, currentAccount } from "../auth/authorize.ts";
import { openQuoteRequests, submitQuoteRequest } from "./quote-requests.ts";

export const router = Router();

// open to Guests (the landing page) and signed-in Accounts (the portal)
router.post("/", async (req, res) => {
  const receipt = await submitQuoteRequest(await currentAccount(req), req.body);
  res.status(201).json(receipt);
});

router.get("/", authorize("office_staff"), async (req, res) => {
  res.json(await openQuoteRequests());
});
