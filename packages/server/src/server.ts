import express from "express";
import authRoutes from "./auth/routes.ts";
import quoteRoutes from "./quotes/routes.ts";

const app = express();

app.get("/health", (req, res) => {
  res
    .json({
      status: "ok",
    })
    .status(200);
});

app.use("/api/auth", authRoutes);
app.use("/api/quotes", quoteRoutes);

export { app };
