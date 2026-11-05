import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// What keeps checkouts of this repo on one machine (worktrees, other clones)
// apart when their tests run at once: they share the one test Postgres
// (docker-compose.yml) and the machine's ports, so each names its databases
// with an id of its own and serves its e2e tests from a block of ports of its
// own, both read from where the checkout is. The same checkout always gets the
// same ones. The web and landing e2e configs import it
// (`@empire-cleaning/server/checkout`).
const root = fileURLToPath(new URL("../../..", import.meta.url));
const hash = createHash("sha256").update(root).digest();

// `c` and six hex digits, for database names (tests/setup/testDatabase.ts):
// never all digits, so it never reads as a slot or worker number
export const CHECKOUT = `c${hash.toString("hex").slice(0, 6)}`;

// the first of this checkout's 200 ports for e2e servers
// (packages/web/e2e/slots.ts, packages/landing/playwright.config.ts): one of
// 110 blocks from 10000, all below where Linux picks ports for outgoing
// connections (32768). Two checkouts can draw the same block, and then the
// second's servers fail to start on ports in use: E2E_PORT_BASE gives it
// another
export const E2E_PORTS = Number(
  process.env.E2E_PORT_BASE ?? 10_000 + (hash.readUInt16BE(4) % 110) * 200,
);
