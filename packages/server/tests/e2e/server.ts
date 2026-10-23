// runs the real API for the web app's end-to-end tests (packages/web/e2e),
// exactly as in production except that email, payments and the clock are the
// same fakes the server tests use. A second, local-only control server lets
// the tests reset state, create Accounts and read the emails that were "sent".
// Started by Playwright with its environment set (packages/web/playwright.config.ts).
import express from "express";
import type { AccountRole } from "@empire-cleaning/models";
import { setup as recreateTestDatabase } from "../setup/globalSetup.ts";

const CONTROL_PORT = Number(process.env.E2E_CONTROL_PORT ?? 3101);

await recreateTestDatabase();

// imported only now: the app reads its environment and database on import
const { app } = await import("../../src/server.ts");
const { default: env } = await import("../../src/env.ts");
const { createAccount } = await import("../../src/features/auth/index.ts");
const { installFakes, resetDatabase, testEmail } =
  await import("../harness.ts");

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

control.post("/accounts", async (req, res) => {
  const { email, name, roles } = req.body as {
    email: string;
    name: string;
    roles: AccountRole[];
  };
  res.json(await createAccount({ email, name, roles }));
});

control.get("/emails", (req, res) => {
  res.json(testEmail().to(String(req.query.to)));
});

control.listen(CONTROL_PORT, "127.0.0.1", () =>
  console.log(`e2e control on port ${CONTROL_PORT}`),
);
