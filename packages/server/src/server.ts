import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth, router as meRouter } from "#features/auth";
import { router as clientsRouter } from "#features/clients";
import { router as dashboardRouter } from "#features/dashboard";
import { router as scheduleRouter } from "#features/jobs";
import { router as priceListRouter } from "#features/price-list";
import { router as propertiesRouter } from "#features/properties";
import { router as quoteRequestsRouter } from "#features/quote-requests";
import { router as quotesRouter } from "#features/quotes";
import { router as staffRouter } from "#features/staff";
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
app.use("/api/quote-requests", quoteRequestsRouter);
app.use("/api/quotes", quotesRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/properties", propertiesRouter);
app.use("/api/price-list", priceListRouter);
app.use("/api/staff", staffRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/dashboard", dashboardRouter);

app.use(errorHandler);

export { app };
