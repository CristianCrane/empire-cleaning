// runs the real API for the web app's end-to-end tests (packages/web/e2e),
// exactly as in production except that email, payments and the clock are the
// same fakes the server tests use. A second, local-only control server lets
// the tests reset state, add Staff, Clients and Jobs, and read the emails that were
// "sent". Accounts aren't created here: tests sign up, as people do (ADR-0006).
// Started by Playwright with its environment set (packages/web/playwright.config.ts).
import express from "express";
import { eq } from "drizzle-orm";
import type { StaffRole } from "@empire-cleaning/models";
import { setup as recreateTestDatabase } from "../setup/globalSetup.ts";

const CONTROL_PORT = Number(process.env.E2E_CONTROL_PORT ?? 3101);

await recreateTestDatabase();

// imported only now: the app reads its environment and database on import
const { app } = await import("../../src/server.ts");
const { default: env } = await import("../../src/env.ts");
const { createStaff, setUsualWeek } =
  await import("../../src/features/staff/index.ts");
const { createClient } = await import("../../src/features/clients/index.ts");
const { installFakes, resetDatabase, testEmail } =
  await import("../harness.ts");
const { bookedJob } = await import("../fixtures.ts");
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

// a booked Job at a home of its own: nothing in the API books Jobs until
// accepting a Quote (#8)
control.post("/jobs", async (req, res) => {
  res.json(await bookedJob(req.body as Parameters<typeof bookedJob>[0]));
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
