import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// The ports the e2e servers listen on, and what keeps checkouts of this repo
// on one machine (worktrees, other clones) apart when their e2e tests run at
// once: they share the machine's ports, so each serves its e2e tests from a
// block of ports of its own, read from where the checkout is. The same
// checkout always gets the same one. The web and landing e2e configs import
// it (`@empire-cleaning/server/ports`). Their databases need no id from here:
// each run claims names of its own (tests/setup/testDatabase.ts).
const root = fileURLToPath(new URL("../../..", import.meta.url));
const hash = createHash("sha256").update(root).digest();

// the first of this checkout's 200 ports for e2e servers: one of 110 blocks
// from 10000, all below where Linux picks ports for outgoing connections
// (32768). Two checkouts can draw the same block, and then the second's
// servers fail to start on ports in use: E2E_PORT_BASE gives it another
export const E2E_PORTS = Number(
  process.env.E2E_PORT_BASE ?? 10_000 + (hash.readUInt16BE(4) % 110) * 200,
);

// The block, from its first port: the web app's slots (packages/web/e2e/slots.ts),
// three ports each, then the landing site's three
// (packages/landing/playwright.config.ts)

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
