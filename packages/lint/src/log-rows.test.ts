import { describe, expect, it } from "vitest";
import { doubled, logs } from "./log-rows.ts";

const ux = logs.find((log) => log.path === "docs/ux-log.md")!.key;
const testing = logs.find((log) => log.path === "docs/testing-log.md")!.key;

const uxLog = (...rows: string[]) =>
  [
    "# UX decisions log",
    "",
    "| Screen | Question | Variants | Picked | Why | Prototype | Built in |",
    "|---|---|---|---|---|---|---|",
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
    expect(doubled(text, ux)).toEqual([
      { key: ["Office > Today", "Which sections?"], lines: [5, 7] },
    ]);
  });

  it("finds a row edited in place beside its old text, as a union merge keeps it", () => {
    const text = uxLog(
      "| Office > Today | Which sections? | A / B | **A** | one box | — | #94 |",
      "| Office > Today | Which sections? | A / B | **A** (narrowed 2026-11-22: B on a phone) | one box | — | #94 |",
    );
    expect(doubled(text, ux)).toEqual([
      { key: ["Office > Today", "Which sections?"], lines: [5, 6] },
    ]);
  });

  it("passes a screen's two questions, and a question two screens share", () => {
    const text = uxLog(
      "| Office > Today | Which sections? | A / B | **A** | why | — | #94 |",
      "| Office > Today | What leads? | A / B | **A** | why | — | #94 |",
      "| Office > Bills | What leads? | A / B | **A** | why | — | #95 |",
    );
    expect(doubled(text, ux)).toEqual([]);
  });

  it("reads a cell by its column past an escaped pipe", () => {
    // split on that pipe, both rows' Question would read "Details "
    const text = uxLog(
      "| Office > Property | Details \\| History | A / B | **A** | why | — | #200 |",
      "| Office > Property | Details \\| Visits | A / B | **A** | why | — | #200 |",
    );
    expect(doubled(text, ux)).toEqual([]);
  });

  it("keys a finding by its date and its first 80 characters", () => {
    const start =
      "The fake gateway's failCharges declined the Charge with reason processing and no id";
    const text = [
      "# Test findings log",
      "",
      "| Date | Finding | Where |",
      "| --- | --- | --- |",
      `| 2026-11-23 | ${start}, so nothing stayed open | #533 |`,
      `| 2026-11-23 | ${start}, so nothing stayed open: a fake gives the provider's shape | #533 |`,
      `| 2026-11-22 | ${start}, so nothing stayed open | #533 |`,
      "| 2026-11-23 | A Notice is role alert only in danger | #493 |",
    ].join("\n");
    expect(doubled(text, testing)).toEqual([
      { key: ["2026-11-23", start.slice(0, 80)], lines: [5, 6] },
    ]);
  });
});
