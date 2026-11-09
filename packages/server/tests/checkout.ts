import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// What keeps checkouts of this repo on one machine (worktrees, other clones)
// apart when their e2e tests run at once: they share the machine's ports, so
// each serves its e2e tests from a block of ports of its own, read from where
// the checkout is. The same checkout always gets the same one. The web and
// landing e2e configs import it (`@empire-cleaning/server/checkout`). Their
// databases need no id from here: each run claims names of its own
// (tests/setup/testDatabase.ts).
const root = fileURLToPath(new URL("../../..", import.meta.url));
const hash = createHash("sha256").update(root).digest();

// the first of this checkout's 200 ports for e2e servers
// (packages/web/e2e/slots.ts, packages/landing/playwright.config.ts): one of
// 110 blocks from 10000, all below where Linux picks ports for outgoing
// connections (32768). Two checkouts can draw the same block, and then the
// second's servers fail to start on ports in use: E2E_PORT_BASE gives it
// another
export const E2E_PORTS = Number(
  process.env.E2E_PORT_BASE ?? 10_000 + (hash.readUInt16BE(4) % 110) * 200,
);
