import { Router } from "express";
import { authorize } from "../auth/authorize.ts";
import { needsAttention } from "./needs-attention.ts";
import { today } from "./today.ts";

export const router = Router();

router.use(authorize("office_staff"));

// GET /api/dashboard/needs-attention
router.get("/needs-attention", async (req, res) => {
  res.json(await needsAttention());
});

// GET /api/dashboard/today
router.get("/today", async (req, res) => {
  res.json(await today());
});
