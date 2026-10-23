import request from "supertest";
import { sql } from "drizzle-orm";
import { app } from "../src/server.ts";
import { db } from "#db";
import { setClock } from "#services/clock";
import { setPaymentGateway } from "#services/payment-gateway";
import { setEmailSender } from "#services/email";
import { FakeClock } from "./fakes/clock.ts";
import { FakePaymentGateway } from "./fakes/payment-gateway.ts";
import { FakeEmailSender } from "./fakes/email.ts";

type Fakes = {
  clock: FakeClock;
  payments: FakePaymentGateway;
  email: FakeEmailSender;
};

let fakes: Fakes | null = null;

// fresh fakes are installed before every test (see setup/perTest.ts)
export const installFakes = () => {
  fakes = {
    clock: new FakeClock(),
    payments: new FakePaymentGateway(),
    email: new FakeEmailSender(),
  };
  setClock(fakes.clock);
  setPaymentGateway(fakes.payments);
  setEmailSender(fakes.email);
};

const current = () => {
  if (!fakes) throw new Error("fakes are installed per test; call from a test");
  return fakes;
};

export const testClock = () => current().clock;
export const testPayments = () => current().payments;
export const testEmail = () => current().email;

// empties every table except drizzle's migration bookkeeping
export const resetDatabase = async () => {
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length === 0) return;

  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.execute(
    sql.raw(`truncate table ${tables} restart identity cascade`),
  );
};

// drives the real Express app over HTTP: api().get("/health").
// Use apiAgent() when a test needs cookies (e.g. a signed-in session) to persist.
export const api = () => request(app);
export const apiAgent = () => request.agent(app);
