import express from "express";
import authRoutes from "./auth/routes.ts";
import quoteRoutes from "./quotes/routes.ts";
import { networkLoggingMiddleware, corsMiddleware } from "#middleware";

const app = express();

// middleware
app.use(corsMiddleware);
app.use(networkLoggingMiddleware);
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
