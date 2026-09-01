import { Router } from "express";

const router = Router();

router.get("/request", (req, res) => {
  return res.json({ message: "request quote" });
});

router.get("/", (req, res) => {
  return res.json({ message: "list quotes" });
});

router.get("/:id", (req, res) => {
  return res.json({ message: "get quote" });
});

router.post("/", (req, res) => {
  return res.json({ message: "create quote" });
});

router.put("/:id", (req, res) => {
  return res.json({ message: "update quote" });
});

router.delete("/:id", (req, res) => {
  return res.json({ message: "delete quote" });
});

export default router;
