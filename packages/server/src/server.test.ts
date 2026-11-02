import { expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "#db";
import { clock } from "#services/clock";
import { paymentGateway } from "#services/payment-gateway";
import { email, paragraph } from "#services/email";
import { createClient } from "#features/clients";
import {
  api,
  testClock,
  testEmail,
  testMonitoring,
  testPayments,
} from "../tests/harness.ts";
import { casey, signInAsOffice } from "../tests/fixtures.ts";

test("health check responds over HTTP", async () => {
  const res = await api().get("/health");

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
});

test("health check is 503 when the database doesn't answer (ADR-0007)", async () => {
  vi.spyOn(db, "execute").mockRejectedValueOnce(
    new Error("connect ECONNREFUSED"),
  );

  const res = await api().get("/health");

  expect(res.status).toBe(503);
  expect(res.body).toEqual({ status: "database unreachable" });
});

test("every answer carries the security headers, and doesn't name Express (#225)", async () => {
  for (const res of [
    await api().get("/health"),
    await api().get("/api/me"),
    await api().post("/api/quotes/ask").send({}),
    await api().get("/api/auth/get-session"),
  ]) {
    expect(res.headers).toMatchObject({
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
    });
    expect(res.headers).not.toHaveProperty("x-powered-by");
  }
});

// another site's form can post here without the browser asking first (CORS),
// so a form's body is never read, even signed in and all strings (#229)
test("only JSON bodies are read, never a form's", async () => {
  const client = await createClient(casey);
  const office = await signInAsOffice();

  await office
    .post("/api/payment-methods/requests")
    .type("form")
    .send({ clientId: client.id })
    .expect(400);

  expect(testEmail().to(casey.email)).toEqual([]);
});

test("a 4xx is normal business, never reported (ADR-0007)", async () => {
  await api().post("/api/quotes/ask").send({}).expect(400);
  await api().get("/api/me").expect(401);

  expect(testMonitoring().errors).toEqual([]);
});

test("anyone can ask which site this is", async () => {
  const res = await api().get("/api/site");

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ mode: "dev" });
});

test("tests run against the dedicated test database", async () => {
  const { rows } = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );

  // one of the workers' copies of empire_test (tests/setup/workerDatabase.ts)
  expect(rows[0]?.name).toMatch(/^empire_test_\d+$/);
});

test("time can be set and advanced through the injected clock", () => {
  testClock().set(new Date("2026-03-01T10:00:00Z"));
  expect(clock.now()).toEqual(new Date("2026-03-01T10:00:00Z"));

  testClock().advance({ days: 1, hours: 2 });
  expect(clock.now()).toEqual(new Date("2026-03-02T12:00:00Z"));
});

test("payments go to the fake gateway, which records them", async () => {
  const { payerId } = await paymentGateway.createPayer({
    clientId: "client-1",
    name: "Casey Client",
    email: "casey@example.com",
  });
  const deposit = await paymentGateway.takeDeposit({
    payerId,
    source: { token: testPayments().paymentToken() },
    amount: 5000,
    description: "Deposit",
    idempotencyKey: "deposit:1",
  });
  if (deposit.status !== "succeeded") throw new Error("expected a Deposit");
  const refund = await paymentGateway.refund({
    chargeId: deposit.chargeId!,
    amount: 5000,
    idempotencyKey: "refund:1",
  });

  expect(deposit.saved?.label).toBe("Test card ending 4242");
  expect(refund.ok).toBe(true);
  expect(testPayments().charges).toMatchObject([{ amount: 5000 }]);
  expect(testPayments().refunds).toMatchObject([{ amount: 5000 }]);
});

test("the fake gateway can be told to decline charges", async () => {
  testPayments().failCharges("card_declined");

  const result = await paymentGateway.charge({
    payerId: "cus_any",
    paymentMethodId: "pm_any",
    amount: 5000,
    description: "Deposit",
    idempotencyKey: "deposit:1",
  });

  expect(result).toEqual({ ok: false, reason: "card_declined" });
  expect(testPayments().charges).toEqual([]);
});

test("refunds cannot exceed the original charge, and a repeated key repeats nothing", async () => {
  const charge = await paymentGateway.charge({
    payerId: "cus_any",
    paymentMethodId: "pm_any",
    amount: 5000,
    description: "Deposit",
    idempotencyKey: "deposit:1",
  });
  if (!charge.ok) throw new Error("expected charge to succeed");
  const again = await paymentGateway.charge({
    payerId: "cus_any",
    paymentMethodId: "pm_any",
    amount: 5000,
    description: "Deposit",
    idempotencyKey: "deposit:1",
  });

  const result = await paymentGateway.refund({
    chargeId: charge.chargeId,
    amount: 5001,
    idempotencyKey: "refund:1",
  });

  expect(again).toEqual(charge);
  expect(testPayments().charges).toHaveLength(1);
  expect(result).toEqual({ ok: false, reason: "exceeds_charge" });
});

test("emails are captured by the fake sender", async () => {
  await email.send({
    to: "client@example.com",
    subject: "Your Quote",
    blocks: [paragraph("hello")],
  });

  expect(testEmail().lastTo("client@example.com").subject).toBe("Your Quote");
});

test("fakes are fresh for every test", () => {
  expect(testEmail().to(casey.email)).toEqual([]);
  expect(testPayments().charges).toEqual([]);
});
