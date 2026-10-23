import { beforeEach } from "vitest";
import { installFakes, resetDatabase } from "../harness.ts";

beforeEach(async () => {
  installFakes();
  await resetDatabase();
});
