import { afterEach, expect, test } from "vitest";
import { createClient } from "#features/clients";
import { createStaff, deactivateStaff } from "#features/staff";
import env from "../../env.ts";
import { api } from "../../../tests/harness.ts";

const mode = env.APP_MODE;
afterEach(() => {
  env.APP_MODE = mode;
});

test("anyone can list the demo people who are here, Staff first, with what each shows", async () => {
  await createClient({
    name: "Helen Kowalski",
    email: "owner+helen@example.com",
    phone: "(718) 555-0100",
  });
  await createStaff({
    name: "Maria Gonzalez",
    email: "owner+maria@example.com",
    roles: ["cleaner"],
  });
  await createStaff({
    name: "Jennifer",
    email: "owner@example.com",
    roles: ["office_staff", "cleaner"],
  });
  // not in the demo
  await createClient({
    name: "Real Person",
    email: "real@example.com",
    phone: "(718) 555-0101",
  });

  const res = await api().get("/api/demo-people").expect(200);

  expect(res.body).toEqual([
    {
      name: "Jennifer",
      email: "owner@example.com",
      role: "office_staff",
      shows: "Runs the business",
    },
    {
      name: "Maria Gonzalez",
      email: "owner+maria@example.com",
      role: "cleaner",
      shows: "Helen's cleaner, with a job offered to her",
    },
    {
      name: "Helen Kowalski",
      email: "owner+helen@example.com",
      role: "client",
      shows: "On a weekly plan",
    },
  ]);
});

test("Staff who've left aren't listed", async () => {
  const luz = await createStaff({
    name: "Luz Herrera",
    email: "owner+luz@example.com",
    roles: ["cleaner"],
  });
  await deactivateStaff(luz.id);

  const res = await api().get("/api/demo-people").expect(200);

  expect(res.body).toEqual([]);
});

test("the real site has no demo people to give away", async () => {
  await createClient({
    name: "Helen Kowalski",
    email: "owner+helen@example.com",
    phone: "(718) 555-0100",
  });
  env.APP_MODE = "prod";

  await api().get("/api/demo-people").expect(404);
});
