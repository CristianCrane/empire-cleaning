import { describe, expect, test } from "vitest";
import type { NeedsAttentionItem } from "@empire-cleaning/models";
import { createStaff } from "#features/staff";
import { type Agent, api, signIn } from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

// the test clock starts at 4am on Monday 5 January 2026 in New York

const needsAttention = async (office: Agent) =>
  (await office.get("/api/dashboard/needs-attention").expect(200))
    .body as NeedsAttentionItem[];

describe("the dashboard", () => {
  test("is only for Office Staff", async () => {
    await api().get("/api/dashboard/needs-attention").expect(401);
    await createStaff({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
    });
    const cleaner = await signIn("cory@example.com");
    await cleaner.get("/api/dashboard/needs-attention").expect(403);
  });
});

describe("Needs attention", () => {
  test("is empty when nothing is waiting", async () => {
    const office = await signInAsOffice();

    expect(await needsAttention(office)).toEqual([]);
  });

  test("lists Quotes asked for with nothing Sent yet, longest waiting first", async () => {
    await submit(guestAsk()).expect(201);
    await submit(
      guestAsk({
        contact: { ...casey, name: "Drew Client", email: "drew@example.com" },
        property: { new: { ...home, street: "7 Queens Blvd" } },
      }),
    ).expect(201);
    const office = await signInAsOffice();

    const items = (await needsAttention(office)).filter(
      (i) => i.kind === "quote_requested",
    );

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.quote.client.name)).toEqual([
      "Casey Client",
      "Drew Client",
    ]);
    expect(items[0]).toMatchObject({
      since: items[0]!.quote.createdAt,
      quote: {
        status: "requested",
        asked: { condition: "moderate", wantsRegularService: true },
        property: { street: home.street, postcode: home.postcode },
      },
    });
  });
});
