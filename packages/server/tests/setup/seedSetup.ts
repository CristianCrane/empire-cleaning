import type { TestProject } from "vitest/node";
import { claimTestDatabase } from "./testDatabase.ts";

// The seed test's database names (tests/seed.test.ts), claimed here in
// Vitest's own process rather than in the test's worker, as globalSetup.ts
// claims the server tests': there a lost hold on them ends the run at once,
// where in a worker Vitest turns `process.exit` into an error and the run goes
// on. The test makes its databases under the name it's handed
export async function setup(project: TestProject) {
  const claim = await claimTestDatabase();
  project.provide("testDatabase", claim.url);
  return claim.release;
}
