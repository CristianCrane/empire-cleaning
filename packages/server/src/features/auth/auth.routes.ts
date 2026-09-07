import { Router } from "express";

export const router = Router();

router.post("/signup", (req, res) => {
  res.status(201).json({ message: "user signed up" });
});

router.post("/login", (req, res) => {
  res.status(201).json({ message: "user signed in" });
});
