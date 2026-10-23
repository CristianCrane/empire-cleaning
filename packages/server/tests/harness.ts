import type { AddressInfo } from "node:net";
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

type ApiResponse<T> = {
  status: number;
  headers: Headers;
  body: T;
};

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

const baseUrl = await new Promise<string>((resolve) => {
  const server = app.listen(0, () => {
    const { port } = server.address() as AddressInfo;
    resolve(`http://127.0.0.1:${port}`);
  });
  server.unref();
});

const request = async <T = any>(
  method: string,
  path: string,
  { body, headers = {} }: RequestOptions = {},
): Promise<ApiResponse<T>> => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    body: text ? JSON.parse(text) : undefined,
  };
};

// drives the real Express app over HTTP
export const api = {
  get: <T = any>(path: string, opts?: RequestOptions) =>
    request<T>("GET", path, opts),
  post: <T = any>(path: string, opts?: RequestOptions) =>
    request<T>("POST", path, opts),
  put: <T = any>(path: string, opts?: RequestOptions) =>
    request<T>("PUT", path, opts),
  patch: <T = any>(path: string, opts?: RequestOptions) =>
    request<T>("PATCH", path, opts),
  delete: <T = any>(path: string, opts?: RequestOptions) =>
    request<T>("DELETE", path, opts),
};
