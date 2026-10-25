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

// Empties every table except drizzle's migration bookkeeping, before every
// test. With DELETE, not TRUNCATE: truncating creates and syncs fresh files for
// every table and index, which takes seconds on a Docker volume (and more with
// each table added), where deleting the few rows a test leaves takes
// milliseconds. One transaction, so one sync.
export const resetDatabase = async () => {
  await db.transaction(async (tx) => {
    // delete in any order: skip foreign key checks, as truncate ... cascade did
    // (needs a superuser, which the local test database's user is)
    await tx.execute(sql`set local session_replication_role = replica`);

    const { rows: tables } = await tx.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    );
    for (const { tablename } of tables) {
      await tx.execute(sql.raw(`delete from "public"."${tablename}"`));
    }

    // identity columns count from 1 again, as truncate ... restart identity did
    const { rows: identities } = await tx.execute<{
      table_name: string;
      column_name: string;
    }>(
      sql`select table_name, column_name from information_schema.columns
          where table_schema = 'public' and is_identity = 'YES'`,
    );
    for (const { table_name, column_name } of identities) {
      await tx.execute(
        sql.raw(
          `alter table "public"."${table_name}" alter column "${column_name}" restart`,
        ),
      );
    }
  });
};

// drives the real Express app over HTTP: api().get("/health").
// Use apiAgent() when a test needs cookies (e.g. a signed-in session) to persist.
export const api = () => request(app);
export const apiAgent = () => request.agent(app);

// the path and query of the sign-in link in the latest email to `address`
export const signInLinkFor = (address: string) => {
  const { text } = testEmail().lastTo(address);
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`no sign-in link in the email to ${address}`);
  const url = new URL(match[0]);
  return `${url.pathname}${url.search}`;
};

// signs in the way a person does (request a link, follow it) and returns an
// agent that carries the session cookie on every later request
export const signIn = async (address: string) => {
  const agent = apiAgent();
  await agent
    .post("/api/auth/sign-in/magic-link")
    .send({ email: address, callbackURL: "/" })
    .expect(200);
  await agent.get(signInLinkFor(address)).expect(302);
  return agent;
};
