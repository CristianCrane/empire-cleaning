import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "#db";
import { clock } from "#services/clock";
import { paymentGateway } from "#services/payment-gateway";
import { email } from "#services/email";
import { api, testClock, testEmail, testPayments } from "../tests/harness.ts";

test("health check responds over HTTP", async () => {
  const res = await api().get("/health");

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
});

test("tests run against the dedicated test database", async () => {
  const { rows } = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );

  expect(rows[0]?.name).toBe("empire_test");
});

test("time can be set and advanced through the injected clock", () => {
  testClock().set(new Date("2026-03-01T10:00:00Z"));
  expect(clock.now()).toEqual(new Date("2026-03-01T10:00:00Z"));

  testClock().advance({ days: 1, hours: 2 });
  expect(clock.now()).toEqual(new Date("2026-03-02T12:00:00Z"));
});

test("payments go to the fake gateway, which records them", async () => {
  const form = await paymentGateway.startCardForm();
  expect(form.form).toBe("test");
  const { paymentMethodId } = await paymentGateway.savePaymentMethod({
    clientId: "client-1",
    token: form.secret,
  });
  const charge = await paymentGateway.charge({
    paymentMethodId,
    amount: 5000,
    description: "Deposit",
  });
  if (!charge.ok) throw new Error("expected charge to succeed");
  const refund = await paymentGateway.refund({
    chargeId: charge.chargeId,
    amount: 5000,
  });

  expect(refund.ok).toBe(true);
  expect(testPayments().charges).toMatchObject([{ amount: 5000 }]);
  expect(testPayments().refunds).toMatchObject([{ amount: 5000 }]);
});

test("the fake gateway can be told to decline charges", async () => {
  testPayments().failCharges("card_declined");

  const result = await paymentGateway.charge({
    paymentMethodId: "pm_any",
    amount: 5000,
    description: "Deposit",
  });

  expect(result).toEqual({ ok: false, reason: "card_declined" });
  expect(testPayments().charges).toEqual([]);
});

test("refunds cannot exceed the original charge", async () => {
  const charge = await paymentGateway.charge({
    paymentMethodId: "pm_any",
    amount: 5000,
    description: "Deposit",
  });
  if (!charge.ok) throw new Error("expected charge to succeed");

  const result = await paymentGateway.refund({
    chargeId: charge.chargeId,
    amount: 5001,
  });

  expect(result).toEqual({ ok: false, reason: "exceeds_charge" });
});

test("emails are captured by the fake sender", async () => {
  await email.send({
    to: "client@example.com",
    subject: "Your Quote",
    html: "<p>hello</p>",
    text: "hello",
  });

  expect(testEmail().lastTo("client@example.com").subject).toBe("Your Quote");
});

test("fakes are fresh for every test", () => {
  expect(testEmail().sent).toEqual([]);
  expect(testPayments().charges).toEqual([]);
});
