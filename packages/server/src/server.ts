import express from "express";
import { toNodeHandler } from "better-auth/node";
import {
  jobAssignmentsRouter,
  router as assignmentsRouter,
} from "#features/assignments/assignments.routes";
import { router as meRouter } from "#features/auth/auth.routes";
import { auth } from "#features/auth/auth";
import {
  clientBillingRouter,
  router as billsRouter,
} from "#features/bills/bills.routes";
import {
  clientCancellationRouter,
  noAccessRouter,
  officeCancellationRouter,
} from "#features/cancellation/cancellation.routes";
import {
  cleanerCompletionRouter,
  clientJobsRouter,
  officeCompletionRouter,
} from "#features/completion/completion.routes";
import { router as clientsRouter } from "#features/clients/clients.routes";
import { router as dashboardRouter } from "#features/dashboard/dashboard.routes";
import { jobsRouter } from "#features/jobs/jobs.routes";
import { router as scheduleRouter } from "#features/jobs/schedule.routes";
import { router as paymentMethodsRouter } from "#features/payments/payments.routes";
import { webhookRouter } from "#features/payments/webhook.routes";
import { router as priceListRouter } from "#features/price-list/price-list.routes";
import { router as propertiesRouter } from "#features/properties/properties.routes";
import { router as quotesRouter } from "#features/quotes/quotes.routes";
import {
  clientRescheduleRouter,
  officeRescheduleRouter,
} from "#features/reschedule/reschedule.routes";
import { router as servicePlansRouter } from "#features/service-plans/service-plans.routes";
import {
  propertyFindingsRouter,
  router as siteVisitsRouter,
} from "#features/site-visits/site-visits.routes";
import { router as staffRouter } from "#features/staff/staff.routes";
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
app.use("/api/quotes", quotesRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/clients", clientBillingRouter);
app.use("/api/properties", propertiesRouter);
app.use("/api/properties", propertyFindingsRouter);
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
app.use("/api/site-visits", siteVisitsRouter);
app.use("/api/bills", billsRouter);

app.use(errorHandler);

export { app };
