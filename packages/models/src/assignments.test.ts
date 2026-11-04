import { expect, test } from "vitest";
import { holdsPlace } from "./index.js";

// only Offered and Confirmed hold a place: a Released one, or one Office
// Staff took off, has let it go
test("who holds a place on a Job's crew", () => {
  expect(holdsPlace("offered")).toBe(true);
  expect(holdsPlace("confirmed")).toBe(true);
  expect(holdsPlace("released")).toBe(false);
  expect(holdsPlace("taken_off")).toBe(false);
});
