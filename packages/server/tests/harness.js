import { sql } from "drizzle-orm";
import { app } from "../src/server.js";
import { db } from "#db";
import { setClock } from "#services/clock";
import { setPaymentGateway } from "#services/payment-gateway";
import { setEmailSender } from "#services/email";
import { FakeClock } from "./fakes/clock.js";
import { FakePaymentGateway } from "./fakes/payment-gateway.js";
import { FakeEmailSender } from "./fakes/email.js";
let fakes = null;
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
    if (!fakes)
        throw new Error("fakes are installed per test; call from a test");
    return fakes;
};
export const testClock = () => current().clock;
export const testPayments = () => current().payments;
export const testEmail = () => current().email;
// empties every table except drizzle's migration bookkeeping
export const resetDatabase = async () => {
    const { rows } = await db.execute(sql `select tablename from pg_tables where schemaname = 'public'`);
    if (rows.length === 0)
        return;
    const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
    await db.execute(sql.raw(`truncate table ${tables} restart identity cascade`));
};
const baseUrl = await new Promise((resolve) => {
    const server = app.listen(0, () => {
        const { port } = server.address();
        resolve(`http://127.0.0.1:${port}`);
    });
    server.unref();
});
const request = async (method, path, { body, headers = {} } = {}) => {
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
    get: (path, opts) => request("GET", path, opts),
    post: (path, opts) => request("POST", path, opts),
    put: (path, opts) => request("PUT", path, opts),
    patch: (path, opts) => request("PATCH", path, opts),
    delete: (path, opts) => request("DELETE", path, opts),
};
