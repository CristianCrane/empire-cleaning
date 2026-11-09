import { expect, test } from "vitest";
import { isOnCrew } from "./index.ts";

// only Offered and Confirmed are on the crew: a Released one, or one Office
// Staff took off, has let it go
test("who is on a Job's crew", () => {
  expect(isOnCrew("offered")).toBe(true);
  expect(isOnCrew("confirmed")).toBe(true);
  expect(isOnCrew("released")).toBe(false);
  expect(isOnCrew("taken_off")).toBe(false);
});
