import express from "express";
import { router as authRouter } from "#features/auth";
import { router as quotesRouter } from "#features/quotes";
import {
  networkLoggingMiddleware,
  corsMiddleware,
  errorHandler,
} from "#middleware";

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

app.use("/api/auth", authRouter);
app.use("/api/quotes", quotesRouter);

app.use(errorHandler);

export { app };
