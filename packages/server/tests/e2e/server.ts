// runs the real API for the web app's end-to-end tests (packages/web/e2e),
// exactly as in production except that email, payments and the clock are the
// same fakes the server tests use. A second, local-only control server lets
// the tests reset state, add Staff, Clients and Jobs, move the clock and read
// the emails that were "sent". Accounts aren't created here: tests sign up, as people do (ADR-0006).
// Started by Playwright with its environment set (packages/web/playwright.config.ts).
import express from "express";
import { eq } from "drizzle-orm";
import type { StaffRole } from "@empire-cleaning/models";
import type { Approval } from "../fakes/payment-gateway.ts";
import { setup as recreateTestDatabase } from "../setup/globalSetup.ts";

const CONTROL_PORT = Number(process.env.E2E_CONTROL_PORT ?? 3101);

await recreateTestDatabase();

// imported only now: the app reads its environment and database on import
const { app } = await import("../../src/server.ts");
const { default: env } = await import("../../src/env.ts");
const { createStaff, setUsualWeek } =
  await import("../../src/features/staff/index.ts");
const { createClient } = await import("../../src/features/clients/index.ts");
const { sendDueReminders } = await import("../../src/features/jobs/index.ts");
const { confirmAssignment, offerAssignment } =
  await import("../../src/features/assignments/index.ts");
const { installFakes, resetDatabase, testClock, testEmail, testPayments } =
  await import("../harness.ts");
const { acceptedJob, bookedJob } = await import("../fixtures.ts");
const { chaseProposedAdjustments, completeJob } =
  await import("../../src/features/completion/index.ts");
const { db } = await import("../../src/db/index.ts");
const { accounts } = await import("../../src/features/auth/auth.schema.ts");

installFakes();
app.listen(env.PORT, () => console.log(`e2e API on port ${env.PORT}`));

const control = express();
control.use(express.json());

control.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// a clean slate before each test
control.post("/reset", async (_req, res) => {
  installFakes();
  await resetDatabase();
  res.json({ status: "ok" });
});

control.post("/staff", async (req, res) => {
  const { email, name, roles } = req.body as {
    email: string;
    name: string;
    roles: StaffRole[];
  };
  res.json(await createStaff({ email, name, roles }));
});

// the hours a Staff member is usually available, Monday first
control.put("/staff/:id/usual-week", async (req, res) => {
  const { usualWeek } = req.body as { usualWeek: number[] };
  res.json(await setUsualWeek(req.params.id, usualWeek));
});

// a booked Job at a home of its own, straight onto the Schedule
control.post("/jobs", async (req, res) => {
  res.json(await bookedJob(req.body as Parameters<typeof bookedJob>[0]));
});

// a Deep Clean booked by accepting a Quote, so it has a price: Quoted by the
// Office Staff member with `officeEmail` (who must have signed up), with a
// card saved by the Client and the Deposit taken
control.post("/jobs/accepted", async (req, res) => {
  const { officeEmail, ...job } = req.body as {
    officeEmail: string;
  } & Omit<Parameters<typeof acceptedJob>[0], "byAccountId">;
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, officeEmail));
  res.json(await acceptedJob({ ...job, byAccountId: account!.id }));
});

// a place on a Job Offered to a Cleaner, as Office Staff do, and Confirmed
// by them too if `confirmed`
control.post("/jobs/:id/assignments", async (req, res) => {
  const { staffId, confirmed } = req.body as {
    staffId: string;
    confirmed?: boolean;
  };
  const job = await offerAssignment(req.params.id, staffId, "control");
  const place = job.assignments.find((a) => a.staff.id === staffId)!;
  if (confirmed) await confirmAssignment(staffId, place.id);
  res.json(place);
});

// every Charge is declined with this reason from now on; null to stop
control.post("/payments/fail", (req, res) => {
  const { reason } = req.body as { reason: string | null };
  testPayments().failCharges(reason);
  res.json({ status: "ok" });
});

// a card entered in the payment form needs the bank's approval from now on,
// which it then gives ("approved"), refuses or is still waiting on; null to
// stop
control.post("/payments/approval", (req, res) => {
  const { then } = req.body as { then: Approval | null };
  testPayments().requireApproval(then);
  res.json({ status: "ok" });
});

// what the server's reminder timer does (it doesn't run here)
control.post("/reminders", async (_req, res) => {
  res.json({ sent: await sendDueReminders() });
});

// a Job marked Completed by a Cleaner with a Confirmed place on it, as on
// their phone
control.post("/jobs/:id/complete", async (req, res) => {
  const { staffId, ...input } = req.body as { staffId: string } & Parameters<
    typeof completeJob
  >[2];
  await completeJob(staffId, req.params.id, input);
  res.json({ status: "ok" });
});

// what the server's timer does to increases proposed to Clients
control.post("/adjustments/chase", async (_req, res) => {
  await chaseProposedAdjustments();
  res.json({ status: "ok" });
});

// moves the API's clock, e.g. to a Quote's last two days
control.post("/clock", (req, res) => {
  const { at } = req.body as { at: string };
  testClock().set(new Date(at));
  res.json({ status: "ok" });
});

control.post("/clients", async (req, res) => {
  const { email, name, phone } = req.body as {
    email: string;
    name: string;
    phone?: string;
  };
  res.json(
    await createClient({ email, name, phone: phone ?? "(646) 555-0100" }),
  );
});

// Signs a person in the way the app does (ask for a link, follow it from the
// email) but without a browser, and returns the session cookies. For tests
// whose subject isn't signing in: they start signed in without the form, the
// email and the page loads. The sign-in tests still do all of it for real.
control.post("/sessions", async (req, res) => {
  const { email } = req.body as { email: string };
  const api = `http://localhost:${env.PORT}`;

  const asked = await fetch(`${api}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: env.CORS_ORIGIN_URL,
    },
    body: JSON.stringify({ email, callbackURL: "/" }),
  });
  if (!asked.ok) throw new Error(`sign-in link refused: ${asked.status}`);

  const link = testEmail()
    .lastTo(email)
    .text.match(/https?:\/\/\S+/)![0];
  const verified = await fetch(link, { redirect: "manual" });
  res.json(
    verified.headers.getSetCookie().map((cookie) => {
      const pair = cookie.split(";")[0]!;
      const at = pair.indexOf("=");
      return { name: pair.slice(0, at), value: pair.slice(at + 1) };
    }),
  );
});

// stands in for a Google sign-in's profile picture landing on the Account
// (the server tests cover the real Google flow)
control.post("/accounts/picture", async (req, res) => {
  const { email, picture } = req.body as { email: string; picture: string };
  await db
    .update(accounts)
    .set({ image: picture })
    .where(eq(accounts.email, email));
  res.json({ status: "ok" });
});

control.get("/emails", (req, res) => {
  res.json(testEmail().to(String(req.query.to)));
});

control.listen(CONTROL_PORT, "127.0.0.1", () =>
  console.log(`e2e control on port ${CONTROL_PORT}`),
);
