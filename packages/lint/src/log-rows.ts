// A row the UX or test findings log holds twice. The logs merge with git's
// union driver (.gitattributes, the process log's L181), which keeps every
// line both sides wrote where a plain merge would stop on a conflict, and
// drops none: so a row one branch edited in place, as a later pick narrows an
// older one (`(narrowed <date>: …)` in Picked) or widens its Screen, comes
// back beside its old text, which reads as a decision still standing. `pnpm
// lint` runs this, in CI's Checks.
//
// A row is known by its key, each cell's first 80 characters: a UX decision
// by its Question, which an edit that widens the Screen keeps; a finding by
// its Date and Finding, so an edit at a finding's end still matches. What it
// can't see is one row under two keys: a Question reworded in place, a
// finding rewritten from its first words, or the same finding two branches
// logged in their own words (Date and Where would catch the last two, but two
// findings of a day share a Where).
//
// And a new row's long cell: a UX decision's Picked or Why, or a finding,
// over 500 characters. Agents search the logs and read the rows that match
// (CLAUDE.md), so a row is read in full each time a search finds it: one or
// two sentences, its PR or issue holding the rest. A row is new when
// origin/main has no row of its key, so an old row edited in place isn't
// held to it; a Question reworded in place reads as new.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// `capped`: the columns a new row keeps to CAP characters
export type Log = { path: string; key: string[]; capped: string[] };

export const logs: Log[] = [
  { path: "docs/ux-log.md", key: ["Question"], capped: ["Picked", "Why"] },
  {
    path: "docs/testing-log.md",
    key: ["Date", "Finding"],
    capped: ["Finding"],
  },
];

// holds the first two sentences of 186 of the ux-log's 197 Whys (median about
// 240 characters, p90 about 425, on 2026-11-25), where a whole Why's median
// was 418 and 80 ran past 500
const CAP = 500;

// a new row's cell over CAP, by its line, column and length
export type Long = { line: number; column: string; length: number };

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

// each of the table's rows, by its line and the cells of the columns named
function* rowsOf(text: string, names: string[]) {
  let columns: number[] | undefined;
  for (const [i, line] of text.split("\n").entries()) {
    if (!line.trim().startsWith("|")) continue;
    const row = cells(line);
    if (!columns) {
      const named = names.map((name) => ({ name, column: row.indexOf(name) }));
      const missing = named.filter(({ column }) => column < 0);
      if (missing.length)
        throw new Error(
          `the table has no ${missing.map(({ name }) => name).join(" or ")} column`,
        );
      columns = named.map(({ column }) => column);
      continue;
    }
    if (separator(row)) continue;
    yield { line: i + 1, cells: columns.map((column) => row[column] ?? "") };
  }
}

const keyOf = (cellsOfKey: string[]) =>
  cellsOfKey.map((cell) => cell.slice(0, KEY_CHARS));

export function doubled(text: string, key: string[]): Doubled[] {
  const rows = new Map<string, Doubled>();
  for (const row of rowsOf(text, key)) {
    const cellsOfKey = keyOf(row.cells);
    const id = JSON.stringify(cellsOfKey);
    const found = rows.get(id) ?? { key: cellsOfKey, lines: [] };
    found.lines.push(row.line);
    rows.set(id, found);
  }
  return [...rows.values()].filter((found) => found.lines.length > 1);
}

// the cells over CAP in rows whose key `base`, the log on origin/main, lacks
export function long(text: string, base: string, log: Log): Long[] {
  const keys = log.key.length;
  const old = new Set(
    [...rowsOf(base, log.key)].map((row) => JSON.stringify(keyOf(row.cells))),
  );
  const found: Long[] = [];
  for (const row of rowsOf(text, [...log.key, ...log.capped])) {
    if (old.has(JSON.stringify(keyOf(row.cells.slice(0, keys))))) continue;
    log.capped.forEach((column, i) => {
      const { length } = row.cells[keys + i]!;
      if (length > CAP) found.push({ line: row.line, column, length });
    });
  }
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const top = fileURLToPath(new URL("../../..", import.meta.url));
  for (const log of logs) {
    const text = readFileSync(join(top, log.path), "utf8");
    for (const found of doubled(text, log.key)) {
      console.error(
        `empire(log-rows): ${log.path}:${found.lines.join(", :")}: the same ${log.key.join(" and ")} (${found.key.join(", ")}) on ${found.lines.length} rows, as a union merge keeps a row edited in place beside its old text: fold them into one row that keeps every edit`,
      );
      process.exitCode = 1;
    }
    let base: string;
    try {
      base = execFileSync("git", ["show", `origin/main:${log.path}`], {
        cwd: top,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      console.error(
        `empire(log-rows): no ${log.path} on origin/main to tell a new row from: git fetch origin, then run it again.`,
      );
      process.exitCode = 1;
      continue;
    }
    for (const found of long(text, base, log)) {
      console.error(
        `empire(log-rows): ${log.path}:${found.line}: a new row's ${found.column} is ${found.length} characters, over ${CAP}: keep it to one or two sentences and link its PR or issue for the rest`,
      );
      process.exitCode = 1;
    }
  }
}
