import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { ephemeralStart, holdLease, leaseRunPorts } from "./lease.ts";

// The ports the e2e servers listen on. Every e2e run on the machine (in any
// checkout: worktrees, other clones) needs ports no other run is using, so
// each leases a block of 200 for as long as it lives (tests/lease.ts): the
// first free one, trying this checkout's own first. Nobody picks one. The web
// and landing e2e configs import it (`@empire-cleaning/server/ports`), and the
// processes a run starts find its block in E2E_PORT_LEASE. Their databases
// need nothing from here: each run claims names of its own
// (tests/setup/testDatabase.ts).
const root = fileURLToPath(new URL("../../..", import.meta.url));
const hash = createHash("sha256").update(root).digest();

const BLOCK = 200;
// 110 blocks from 10000, below where Linux picks ports for outgoing
// connections (32768 up)
const blocks = Array.from({ length: 110 }, (_, i) => 10_000 + i * BLOCK);

// held, so the lease lasts as long as this process
const lease = await leaseRunPorts({
  env: process.env,
  // this checkout's own block, read from where it is, so a checkout keeps the
  // same ports while no other run has them
  own: 10_000 + (hash.readUInt16BE(4) % blocks.length) * BLOCK,
  blocks,
  size: BLOCK,
  ephemeral: ephemeralStart(),
});

// the first of the run's 200 ports. It also names what else is the run's own,
// as no other run has it while this one lives: its builds and test results
// (packages/web/e2e/slots.ts, packages/landing/playwright.config.ts), and
// pr:shots' base worktree and copies (tests/e2e/shots.ts)
export const E2E_PORTS = lease.base;

// the lease of the block from `base` while no run holds it, so what a run
// that ended left there can be cleared with no other run taking the block
// meanwhile (tests/e2e/shots.ts); null while a run holds it
export const holdEndedRun = (base: number) => holdLease(base, BLOCK);

// The block, from its first port: the web app's slots (packages/web/e2e/slots.ts),
// three ports each, then the landing site's three
// (packages/landing/playwright.config.ts), and last (+199) the lease's own

// the slots the block has room for, before the landing site's ports
export const MAX_SLOTS = 60;

// a web e2e slot's three servers: its API, the API's control server, and the
// built app in front of it
export const slotPorts = (slot: number) => ({
  api: E2E_PORTS + slot * 3,
  control: E2E_PORTS + slot * 3 + 1,
  app: E2E_PORTS + slot * 3 + 2,
});

// the landing site's e2e servers: its API, the control server, and the site
export const landingPorts = {
  api: E2E_PORTS + 190,
  control: E2E_PORTS + 191,
  site: E2E_PORTS + 192,
};
