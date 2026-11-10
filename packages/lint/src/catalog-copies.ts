// The same English in two of the screens' catalogs (#397). Each copy is a
// second Spanish to keep in step, and to have checked by the owner (#206):
// a word several screens show has one home (docs/ux.md, Words). An oxlint
// rule sees one file at a time, so this reads them all: `pnpm lint` and the
// pre-commit hook run it on the web app's files and models' messages, which
// a screen reads beside its own catalog (`catalogFiles`).
//
// It reads every string under each `catalog({ en })`, by the key it's under:
// in a function, a template (its placeholders as `${…}`) and a string in a
// placeholder each count, and one with no letter doesn't. The same English
// twice in one catalog is one place to keep in step, so isn't a copy.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "oxc-parser";
import { children, fields, type Fields, type Node } from "./ast.ts";

// one catalog's string, and where it is
export type Place = { path: string; key: string };
type Found = Place & { words: string; catalog: string };

// a copy everyone's agreed to: words whose Spanish differs in each place,
// as it agrees with a different noun, or speaks to a Client (usted) in one
// and a Cleaner (tú) in the other
type Allowed = { words: string; in: string[]; why: string };

export const allowed: Allowed[] = [
  {
    words: "Paid",
    in: [
      "packages/web/src/screens/BillParts.tsx",
      "packages/web/src/screens/portal/PortalJob.tsx",
    ],
    why: "a Bill is Pagada, a charge Pagado",
  },
  {
    words: "Cancelled",
    in: [
      "packages/web/src/screens/BillParts.tsx",
      "packages/web/src/screens/labels.ts",
    ],
    why: "a Bill's state and a Job's: the Spanish agrees with each noun",
  },
  {
    words: "Declined",
    in: [
      "packages/web/src/screens/format.ts",
      "packages/web/src/screens/portal/PortalJob.tsx",
    ],
    why: "a Quote is Rechazada, a price change Rechazado",
  },
  {
    words: "Keep it",
    in: [
      "packages/web/src/screens/cleaner/CleanerJobScreen.tsx",
      "packages/web/src/screens/portal/PortalQuote.tsx",
    ],
    why: "a Quote is Conservarla, a job Conservarlo",
  },
  {
    words: "Done",
    in: [
      "packages/web/src/screens/cleaner/words.ts",
      "packages/web/src/screens/labels.ts",
    ],
    why: "a clean is Terminada, a job Terminado",
  },
  {
    words: "That didn't work. Please try again.",
    in: [
      "packages/web/src/screens/cleaner/CleanerNeededScreen.tsx",
      "packages/web/src/screens/portal/words.ts",
    ],
    why: "usted to a Client (Vuelva a intentarlo), tú to a Cleaner (Vuelve)",
  },
  {
    words: "${…} at ${…}",
    in: [
      "packages/web/src/screens/labels.ts",
      "packages/web/src/screens/portal/whats-next.ts",
    ],
    why: "a day at a time (a las) and a clean at an address (en)",
  },
];

const keyOf = (property: Fields) => {
  const key = fields(property.key);
  return key?.type === "Identifier" ? (key.name as string) : String(key?.value);
};

// "Pay bill ${…}" for `Pay bill ${n}`
const templateWords = (template: Fields) =>
  (template.quasis as Fields[])
    .map((quasi) => (quasi.value as { cooked: string }).cooked)
    .join("${…}");

const hasLetter = (words: string) =>
  /\p{L}/u.test(words.replaceAll("${…}", ""));

// every string under `node`, by the key it's under
const stringsUnder = (node: Node, key: string): [string, string][] => {
  const n = node as Fields;
  if (n.type === "Literal")
    return typeof n.value === "string" ? [[n.value, key]] : [];
  if (n.type === "TemplateLiteral")
    return [
      [templateWords(n), key] as [string, string],
      ...(n.expressions as Node[]).flatMap((e) => stringsUnder(e, key)),
    ];
  if (n.type === "Property")
    return stringsUnder(n.value as Node, `${key}${key ? "." : ""}${keyOf(n)}`);
  // `as`, `satisfies`, `!`: the value, not its type
  if (n.type.startsWith("TS"))
    return n.expression ? stringsUnder(n.expression as Node, key) : [];
  return children(node).flatMap(([, child]) => stringsUnder(child, key));
};

// the English of every catalog in `source`
export const catalogWords = (path: string, source: string): Found[] => {
  const found: Found[] = [];
  let count = 0;
  const visit = (node: Node) => {
    const n = node as Fields;
    if (
      n.type === "CallExpression" &&
      fields(n.callee)?.type === "Identifier" &&
      fields(n.callee)?.name === "catalog"
    ) {
      const catalog = `${path}#${count++}`;
      const words = fields((n.arguments as unknown[])[0]);
      const en = ((words?.properties as Fields[] | undefined) ?? []).find(
        (p) => p.type === "Property" && keyOf(p) === "en",
      );
      for (const [english, key] of en ? stringsUnder(en.value as Node, "") : [])
        if (hasLetter(english))
          found.push({ words: english, key, path, catalog });
    }
    for (const [, child] of children(node)) visit(child);
  };
  visit(parseSync(path, source).program as Node);
  return found;
};

export type Copy = { words: string; places: Place[] };

// each English string in more than one catalog, with every place it's in,
// but those `allow` names
export const catalogCopies = (
  files: { path: string; source: string }[],
  allow: Allowed[] = allowed,
): Copy[] => {
  const byWords = new Map<string, Found[]>();
  for (const { path, source } of files)
    for (const found of catalogWords(path, source))
      byWords.set(found.words, [...(byWords.get(found.words) ?? []), found]);
  return [...byWords]
    .filter(([, found]) => new Set(found.map((f) => f.catalog)).size > 1)
    .filter(
      ([words, found]) =>
        !allow.some(
          (a) => a.words === words && found.every((f) => a.in.includes(f.path)),
        ),
    )
    .map(([words, found]) => ({
      words,
      places: found.map(({ path, key }) => ({ path, key })),
    }));
};

// where the screens' words are: the web app, and models' messages it shows
const catalogFiles = [
  "packages/web/src/*.ts",
  "packages/web/src/*.tsx",
  "packages/models/src/messages/*.ts",
];

if (import.meta.url === `file://${process.argv[1]}`) {
  // the paths from the top of the checkout, wherever it runs from
  const top = fileURLToPath(new URL("../../..", import.meta.url));
  const files = execFileSync("git", ["ls-files", "--", ...catalogFiles], {
    cwd: top,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .map((path) => ({ path, source: readFileSync(join(top, path), "utf8") }));
  const copies = catalogCopies(files);
  for (const { words, places } of copies) {
    console.error(
      `empire(catalog-copies): ${JSON.stringify(words)} is in more than one catalog; give it one home (packages/lint/README.md):`,
    );
    for (const { path, key } of places) console.error(`  ${path}: ${key}`);
  }
  // an allowed copy that's gone stays out of the list
  const all = catalogCopies(files, []);
  const stale = allowed.filter((a) => !all.some((c) => c.words === a.words));
  for (const { words } of stale)
    console.error(
      `empire(catalog-copies): ${JSON.stringify(words)} is allowed but no longer a copy: take it out of packages/lint/src/catalog-copies.ts's allowed`,
    );
  if (copies.length + stale.length > 0) {
    console.error(`Found ${copies.length} copies, ${stale.length} stale.`);
    process.exitCode = 1;
  }
}
