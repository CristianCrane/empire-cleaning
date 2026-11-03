import { beforeEach } from "vitest";
import { installFakes, resetDatabase } from "../harness.ts";
import "./oneConnection.ts";

beforeEach(async () => {
  installFakes();
  await resetDatabase();
});
