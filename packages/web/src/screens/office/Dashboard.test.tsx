import { describe, expect, test } from "vitest";
import type { NeedsAttentionItem } from "@empire-cleaning/models";
import { tilesShow } from "./Dashboard.tsx";

// to-dos as the server sends them, with only what the tiles read
const unpaidJob = {
  kind: "job_unpaid",
  owedCents: 29_233,
} as NeedsAttentionItem;
const planOnHold = {
  kind: "plan_on_hold",
  owedCents: 29_233,
} as NeedsAttentionItem;

describe("the Money tile", () => {
  test("shows what's owed as its number, its to-dos the hint", () => {
    expect(tilesShow([unpaidJob, planOnHold]).money).toEqual({
      value: "$292.33",
      hint: "2 to do",
    });
  });

  // a plan On Hold owes for a Job or Bill counted already, so alone it
  // owes nothing: the tile counts it, as the others count theirs
  test("with plans On Hold alone, counts them", () => {
    expect(tilesShow([planOnHold]).money).toEqual({});
  });
});
