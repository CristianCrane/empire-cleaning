import { Router } from "express";
import { authorize, signedInAccount } from "./authorize.ts";

export const router = Router();

// the signed-in Account; the web app uses this to pick the area to show
router.get("/", authorize(), (req, res) => {
  const { id, email, name, roles } = signedInAccount(res);
  res.json({ id, email, name, roles });
});
