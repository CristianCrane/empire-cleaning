// A row the UX or test findings log holds twice. The logs merge with git's
// union driver (.gitattributes, the process log's L181), which keeps both
// sides' lines where a plain merge would stop on a conflict: so a row one
// branch edited in place, as a later pick narrows an older one (`(narrowed
// <date>: …)` in Picked), comes back beside its old text, and the old text
// reads as a decision still standing. `pnpm lint` runs this, in CI's Checks.
//
// A row is known by its key: a UX decision by its Screen and Question, a
// finding by its Date and Finding, each cell's first 80 characters, so an
// edit at a finding's end still matches. What it can't see: an edit lost, a
// row both sides edited where the merge kept one side's text alone; and a
// finding rewritten from its first words, kept beside its old text (Date and
// Where would catch that, but two findings of a day share a Where).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type Log = { path: string; key: string[] };

export const logs: Log[] = [
  { path: "docs/ux-log.md", key: ["Screen", "Question"] },
  { path: "docs/testing-log.md", key: ["Date", "Finding"] },
];

// rows sharing a key, by the key's cells and the rows' line numbers
export type Doubled = { key: string[]; lines: number[] };

const KEY_CHARS = 80;

// a table row's cells, split on each pipe but an escaped one (`\|`)
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());

const separator = (row: string[]) => row.every((cell) => /^:?-+:?$/.test(cell));

export function doubled(text: string, key: string[]): Doubled[] {
  let columns: number[] | undefined;
  const rows = new Map<string, Doubled>();
  text.split("\n").forEach((line, i) => {
    if (!line.trim().startsWith("|")) return;
    const row = cells(line);
    if (!columns) {
      columns = key.map((name) => row.indexOf(name));
      const missing = key.filter((_, k) => columns![k] < 0);
      if (missing.length)
        throw new Error(`the table has no ${missing.join(" or ")} column`);
      return;
    }
    if (separator(row)) return;
    const cellsOfKey = columns.map((column) =>
      (row[column] ?? "").slice(0, KEY_CHARS),
    );
    const id = JSON.stringify(cellsOfKey);
    const found = rows.get(id) ?? { key: cellsOfKey, lines: [] };
    found.lines.push(i + 1);
    rows.set(id, found);
  });
  return [...rows.values()].filter((found) => found.lines.length > 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const top = fileURLToPath(new URL("../../..", import.meta.url));
  for (const log of logs) {
    for (const found of doubled(
      readFileSync(join(top, log.path), "utf8"),
      log.key,
    )) {
      console.error(
        `empire(log-rows): ${log.path}:${found.lines.join(", :")}: the same ${log.key.join(" and ")} (${found.key.join(", ")}) on ${found.lines.length} rows, as a union merge keeps a row edited in place beside its old text: keep the newer row`,
      );
      process.exitCode = 1;
    }
  }
}
