import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// What keeps checkouts of this repo on one machine (worktrees, other clones)
// apart when their tests run at once: they share the one test Postgres
// (docker-compose.yml), so each names its databases with an id of its own,
// read from where the checkout is. The same checkout always gets the same id.
const root = fileURLToPath(new URL("../../..", import.meta.url));
const hash = createHash("sha256").update(root).digest();

// `c` and six hex digits, for database names (tests/setup/testDatabase.ts):
// never all digits, so it never reads as a slot or worker number
export const CHECKOUT = `c${hash.toString("hex").slice(0, 6)}`;
