// starts every slot's e2e API at once (server.ts), for the web app's and the
// landing site's end-to-end tests: Playwright starts its `webServer` entries
// one after another, ~5 s each, so one entry starts them all
// (packages/web/playwright.config.ts, packages/landing/playwright.config.ts).
// Each slot's database is a copy of one migrated for the run, much quicker
// than migrating each, made while the APIs load. Prints "e2e APIs ready" once
// the copies are made and every slot has said it's ready, which Playwright
// waits for. A slot that exits, a port in use say, or a database
// that can't be made stops the rest at once, rather than leaving Playwright
// to time out.
//
// E2E_SLOTS: the slots, as JSON, each `{ apiUrl, controlUrl, appUrl }`, the
// app's being the origin the API lets in. TEST_DB_URL: the template, whose
// copies are numbered from 0. LANDING_ORIGIN_URL: the landing site's origin.
import { spawn, type ChildProcess } from "node:child_process";
import {
  copiesOf,
  migratedCopies,
  TEST_DB_URL,
} from "../setup/testDatabase.ts";
import { testEnv } from "../setup/testEnv.ts";

type Slot = { apiUrl: string; controlUrl: string; appUrl: string };
const slots = JSON.parse(process.env.E2E_SLOTS ?? "[]") as Slot[];
if (slots.length === 0) throw new Error("E2E_SLOTS names no slot");

// the APIs load, which takes seconds, while their databases are made: an
// API touches its database only once a test asks it something
const databases = copiesOf(TEST_DB_URL, 0, slots.length);
const made = migratedCopies(TEST_DB_URL, 0, slots.length);

const apis: ChildProcess[] = [];
let stopping = false;
const stop = (code: number) => {
  stopping = true;
  for (const api of apis) api.kill();
  process.exit(code);
};
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));

// each a process of its own, in this Node with tsx's loader (execArgv)
const server = new URL("server.ts", import.meta.url).pathname;
// each says "ready" once both its servers listen (server.ts), so a port held
// by something else, which might answer for it, never passes for a slot
const ready = slots.map((slot, i) => {
  const api = spawn(process.execPath, [...process.execArgv, server], {
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    env: {
      ...process.env,
      ...testEnv,
      // as the API logs outside tests
      LOG_LEVEL: "info",
      LANDING_ORIGIN_URL:
        process.env.LANDING_ORIGIN_URL ?? testEnv.LANDING_ORIGIN_URL,
      PORT: new URL(slot.apiUrl).port,
      E2E_CONTROL_PORT: new URL(slot.controlUrl).port,
      BETTER_AUTH_URL: slot.apiUrl,
      CORS_ORIGIN_URL: slot.appUrl,
      DB_URL: databases[i],
    },
  });
  api.on("exit", (code, signal) => {
    if (stopping) return;
    console.error(
      `the e2e API of slot ${i} (${slot.apiUrl}) exited (${signal ?? `code ${code}`}): stopping the rest`,
    );
    stop(1);
  });
  apis.push(api);
  return new Promise<void>((resolve) =>
    api.on("message", (message) => message === "ready" && resolve()),
  );
});

await made.catch((error: unknown) => {
  console.error("the e2e APIs' databases couldn't be made:", error);
  stop(1);
});
await Promise.all(ready);
console.log(`e2e APIs ready: ${slots.length}`);
