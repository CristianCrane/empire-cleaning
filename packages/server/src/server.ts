import express from "express";
import { toNodeHandler } from "better-auth/node";
import {
  jobAssignmentsRouter,
  router as assignmentsRouter,
} from "#features/assignments";
import { auth, router as meRouter } from "#features/auth";
import {
  clientCancellationRouter,
  noAccessRouter,
  officeCancellationRouter,
} from "#features/cancellation";
import {
  cleanerCompletionRouter,
  clientJobsRouter,
  officeCompletionRouter,
} from "#features/completion";
import { router as clientsRouter } from "#features/clients";
import { router as dashboardRouter } from "#features/dashboard";
import { jobsRouter, router as scheduleRouter } from "#features/jobs";
import {
  router as paymentMethodsRouter,
  webhookRouter,
} from "#features/payments";
import { router as priceListRouter } from "#features/price-list";
import { router as propertiesRouter } from "#features/properties";
import { router as quoteRequestsRouter } from "#features/quote-requests";
import { router as quotesRouter } from "#features/quotes";
import {
  clientRescheduleRouter,
  officeRescheduleRouter,
} from "#features/reschedule";
import { router as servicePlansRouter } from "#features/service-plans";
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

// Better Auth and the payment provider's webhook read the raw request body,
// so they are mounted before express.json()
app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use("/api/payments/webhook", webhookRouter);

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
app.use("/api/jobs", jobsRouter);
app.use("/api/jobs", clientJobsRouter);
app.use("/api/jobs", jobAssignmentsRouter);
app.use("/api/jobs", officeCompletionRouter);
app.use("/api/jobs", clientCancellationRouter);
app.use("/api/jobs", officeCancellationRouter);
app.use("/api/jobs", clientRescheduleRouter);
app.use("/api/jobs", officeRescheduleRouter);
app.use("/api/assignments", cleanerCompletionRouter);
app.use("/api/assignments", noAccessRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/payment-methods", paymentMethodsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/service-plans", servicePlansRouter);

app.use(errorHandler);

export { app };
