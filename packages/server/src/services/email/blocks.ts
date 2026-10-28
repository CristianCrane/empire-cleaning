import { formatMoney } from "./format.ts";

// what every email is written from: a builder next to its feature returns
// blocks, and the shared layout (layout.tsx) turns them into the HTML and the
// text part. Pure, so the preview server can import builders without the
// server's environment.

// a "Label: value" line, e.g. When: Monday, January 12 at 9:00 AM
export type Row = { label: string; value: string };

export type Block =
  // "Hi Ana,"
  | { kind: "greeting"; name: string }
  // a "\n" inside one is a line break
  | { kind: "paragraph"; text: string }
  // the facts of a clean: when, where, which Service
  | { kind: "details"; rows: Row[] }
  // money, with the total last and in bold
  | { kind: "amounts"; rows: Row[]; total: Row }
  // the one thing to do; the text part prints its raw URL
  | { kind: "button"; label: string; href: string };

export type Email = {
  subject: string;
  // the inbox preview line; by default the first paragraph
  preview?: string;
  blocks: Block[];
};

export const greeting = (name: string): Block => ({ kind: "greeting", name });

export const paragraph = (text: string): Block => ({ kind: "paragraph", text });

export const details = (rows: Row[]): Block => ({ kind: "details", rows });

// amounts in cents, e.g. amounts([["Clean", 12000]], ["Total", 12000])
export const amounts = (
  rows: [label: string, cents: number][],
  [totalLabel, totalCents]: [label: string, cents: number],
): Block => ({
  kind: "amounts",
  rows: rows.map(([label, cents]) => ({ label, value: formatMoney(cents) })),
  total: { label: totalLabel, value: formatMoney(totalCents) },
});

export const button = (label: string, href: string): Block => ({
  kind: "button",
  label,
  href,
});

export const previewOf = (email: Email) =>
  email.preview ??
  email.blocks.find((block) => block.kind === "paragraph")?.text ??
  "";
