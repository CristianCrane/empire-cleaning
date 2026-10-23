import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth, router as meRouter } from "#features/auth";
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

// Better Auth reads the raw request body, so it is mounted before express.json()
app.all("/api/auth/{*any}", toNodeHandler(auth));

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

app.use("/api/me", meRouter);
app.use("/api/quotes", quotesRouter);

app.use(errorHandler);

export { app };
