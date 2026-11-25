import { describe, expect, it } from "vitest";
import { doubled, logs, long } from "./log-rows.ts";

const ux = logs.find((log) => log.path === "docs/ux-log.md")!;
const testing = logs.find((log) => log.path === "docs/testing-log.md")!;

const uxLog = (...rows: string[]) =>
  [
    "# UX decisions log",
    "",
    "| Screen | Question | Variants | Picked | Why | Prototype | Built in |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");

const testingLog = (...rows: string[]) =>
  [
    "# Test findings log",
    "",
    "| Date | Finding | Where |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");

describe("doubled", () => {
  it("finds a row kept twice, by its lines", () => {
    const row =
      "| Office > Today | Which sections? | A / B | **A** | one box | — | #94 |";
    const text = uxLog(
      row,
      "| Office > Bills | What leads? | A / B | **B** | why | — | #95 |",
      row,
    );
    expect(doubled(text, ux.key)).toEqual([
      { key: ["Which sections?"], lines: [5, 7] },
    ]);
  });

  it("finds a row edited in place beside its old text, as a union merge keeps it", () => {
    const text = uxLog(
      "| Office > Today | Which sections? | A / B | **A** | one box | — | #94 |",
      "| Office > Today | Which sections? | A / B | **A** (narrowed 2026-11-22: B on a phone) | one box | — | #94 |",
    );
    expect(doubled(text, ux.key)).toEqual([
      { key: ["Which sections?"], lines: [5, 6] },
    ]);
  });

  it("finds a row whose Screen was widened in place, by its Question", () => {
    const text = uxLog(
      "| Client > Bill | While a payment was ours, where was Pay? | A / B | **A** | why | — | #493 |",
      "| Client > Bill; Payments' and Home's owed card | While a payment was ours, where was Pay? | A / B | **A** | why | — | #493 |",
    );
    expect(doubled(text, ux.key)).toEqual([
      { key: ["While a payment was ours, where was Pay?"], lines: [5, 6] },
    ]);
  });

  it("passes a screen's two questions", () => {
    const text = uxLog(
      "| Office > Today | Which sections? | A / B | **A** | why | — | #94 |",
      "| Office > Today | What leads? | A / B | **A** | why | — | #94 |",
    );
    expect(doubled(text, ux.key)).toEqual([]);
  });

  it("reads a cell by its column past an escaped pipe", () => {
    // split on that pipe, both rows' Question would read "Details "
    const text = uxLog(
      "| Office > Property | Details \\| History | A / B | **A** | why | — | #200 |",
      "| Office > Property | Details \\| Visits | A / B | **A** | why | — | #200 |",
    );
    expect(doubled(text, ux.key)).toEqual([]);
  });

  it("keys a finding by its date and its first 80 characters", () => {
    const start =
      "The fake gateway's failCharges declined the Charge with reason processing and no id";
    const text = testingLog(
      `| 2026-11-23 | ${start}, so nothing stayed open | #533 |`,
      `| 2026-11-23 | ${start}, so nothing stayed open: a fake gives the provider's shape | #533 |`,
      `| 2026-11-22 | ${start}, so nothing stayed open | #533 |`,
      "| 2026-11-23 | A Notice is role alert only in danger | #493 |",
    );
    expect(doubled(text, testing.key)).toEqual([
      { key: ["2026-11-23", start.slice(0, 80)], lines: [5, 6] },
    ]);
  });
});

describe("long", () => {
  const old =
    "| Office > Today | Which sections? | A / B | **A** | why | — | #94 |";

  it("finds a new row's Why or Picked over 500 characters, by line and column", () => {
    const text = uxLog(
      old,
      `| Office > Bills | What leads? | A / B | **B** | ${"w".repeat(501)} | — | #95 |`,
      `| Office > Jobs | What shows? | A / B | **${"p".repeat(497)}** | ${"w".repeat(500)} | — | #96 |`,
    );
    expect(long(text, uxLog(old), ux)).toEqual([
      { line: 6, column: "Why", length: 501 },
      { line: 7, column: "Picked", length: 501 },
    ]);
  });

  it("passes a row origin/main has by its key, though edited in place past 500", () => {
    const text = uxLog(
      `| Office > Today | Which sections? | A / B | **A** (narrowed 2026-11-25: ${"n".repeat(500)}) | why | — | #94 |`,
    );
    expect(long(text, uxLog(old), ux)).toEqual([]);
  });

  it("finds a new finding over 500 characters, by its date and finding", () => {
    const finding = `A flake ${"f".repeat(493)}`;
    const text = testingLog(
      `| 2026-11-24 | ${finding} | #533 |`,
      `| 2026-11-25 | ${finding} | #534 |`,
    );
    expect(
      long(text, testingLog(`| 2026-11-24 | ${finding} | #533 |`), testing),
    ).toEqual([{ line: 6, column: "Finding", length: 501 }]);
  });
});
