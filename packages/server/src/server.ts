import express from "express";
import authRoutes from "./auth/routes.ts";
import quoteRoutes from "./quotes/routes.ts";
import { networkLogger, corsPolicy } from "#configs";

const app = express();

// middleware
app.use(corsPolicy);
app.use(networkLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
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
