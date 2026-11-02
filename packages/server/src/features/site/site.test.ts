import { afterEach, expect, test } from "vitest";
import env from "../../env.ts";
import { addTesters } from "../../../tests/testers.ts";
import { databaseMode, markDatabase, refuseOnProduction } from "./site.ts";

const mode = env.APP_MODE;
afterEach(() => {
  env.APP_MODE = mode;
});

test("a database no server has run on has no mark", async () => {
  expect(await databaseMode()).toBeNull();
});

test("the server marks its database with its mode, and a later one changes it", async () => {
  await markDatabase("dev");
  await markDatabase("test");

  expect(await databaseMode()).toBe("test");
});

test("once the production server ran on a database, it stays marked prod", async () => {
  await markDatabase("prod");
  await markDatabase("dev");

  expect(await databaseMode()).toBe("prod");
});

test("scripts that wipe or make up data refuse on the production database, whatever their own mode", async () => {
  await markDatabase("prod");

  await expect(refuseOnProduction("The seed")).rejects.toThrow(
    "The seed never runs on the production database",
  );
  await expect(addTesters()).rejects.toThrow("never runs on the production");
});

test("they refuse in production too, before the database is marked", async () => {
  env.APP_MODE = "prod";

  await expect(refuseOnProduction("The seed")).rejects.toThrow();
});

test("they run on a dev or test database", async () => {
  await markDatabase("test");

  await expect(refuseOnProduction("The seed")).resolves.toBeUndefined();
});
