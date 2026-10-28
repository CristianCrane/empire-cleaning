import { describe, expect, test } from "vitest";
import type { ClientListItem } from "@empire-cleaning/models";
import { createStaff } from "#features/staff";
import { api, signIn } from "../../../tests/harness.ts";
import { signInWithGoogle } from "../../../tests/google.ts";
import {
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Office = Awaited<ReturnType<typeof signInAsOffice>>;

const sam = {
  name: "sam Seed",
  email: "sam@example.com",
  phone: "718-555-0199",
};

// Casey with two homes, and Sam with one at 1 Nudge Lane
const twoClients = async () => {
  await submit(guestAsk()).expect(201);
  await submit(
    guestAsk({
      property: { new: { ...home, street: "35-06 Ditmars Blvd", unit: null } },
    }),
  ).expect(201);
  await submit(
    guestAsk({
      contact: sam,
      property: { new: { ...home, street: "1 Nudge Lane", unit: null } },
    }),
  ).expect(201);
};

const search = async (office: Office, q?: string) =>
  (
    (await office.get("/api/clients").query(q === undefined ? {} : { q }))
      .body as ClientListItem[]
  ).map((c) => c.name);

describe("the Office's list of Clients", () => {
  test("is only for Office Staff", async () => {
    await api().get("/api/clients").expect(401);

    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    await client.get("/api/clients").expect(403);

    await createStaff({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
    });
    await (await signIn("cory@example.com")).get("/api/clients").expect(403);
  });

  test("lists every Client in name order, with their contact details", async () => {
    await twoClients();
    const office = await signInAsOffice();

    const { body } = await office.get("/api/clients").expect(200);

    expect(body).toEqual([
      {
        id: expect.any(String),
        name: "Casey Client",
        businessName: null,
        email: "casey@example.com",
        phone: "(646) 555-0100",
        imageUrl: null,
      },
      {
        id: expect.any(String),
        name: "sam Seed",
        businessName: null,
        email: "sam@example.com",
        phone: "718-555-0199",
        imageUrl: null,
      },
    ]);
  });

  test("finds Clients by part of their name, email or Property address, ignoring case", async () => {
    await twoClients();
    const office = await signInAsOffice();

    expect(await search(office, "SEED")).toEqual(["sam Seed"]);
    expect(await search(office, "casey@")).toEqual(["Casey Client"]);
    expect(await search(office, "nud")).toEqual(["sam Seed"]);
    expect(await search(office, "ditmars")).toEqual(["Casey Client"]);
    // the address as it's shown
    expect(await search(office, "Austin St, 4B")).toEqual(["Casey Client"]);
    expect(await search(office, "11375")).toEqual(["Casey Client", "sam Seed"]);
    expect(await search(office, "  ")).toEqual(["Casey Client", "sam Seed"]);
    expect(await search(office, "nobody")).toEqual([]);
  });

  test("finds Clients by phone on its digits alone", async () => {
    await twoClients();
    const office = await signInAsOffice();

    expect(await search(office, "(718) 555")).toEqual(["sam Seed"]);
    expect(await search(office, "718555")).toEqual(["sam Seed"]);
    expect(await search(office, "646-555-0100")).toEqual(["Casey Client"]);
  });

  test("takes % and _ in a search as themselves", async () => {
    await twoClients();
    const office = await signInAsOffice();

    expect(await search(office, "%")).toEqual([]);
    expect(await search(office, "_")).toEqual([]);
  });

  test("shows a Client's Google picture once they sign in with Google", async () => {
    await twoClients();
    const office = await signInAsOffice();
    const picture = "https://lh3.googleusercontent.com/a/casey-photo";

    await signInWithGoogle({ sub: "2001", email: casey.email, picture });

    const { body } = await office.get("/api/clients").expect(200);
    expect((body as ClientListItem[]).map((c) => [c.name, c.imageUrl])).toEqual(
      [
        ["Casey Client", picture],
        ["sam Seed", null],
      ],
    );
  });
});
