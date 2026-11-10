// empire/words-from-catalog over .astro markup (#393). oxlint hands a JS
// plugin only an .astro file's frontmatter and <script>s, so the rule never
// sees the template: this runs the rule's own checks (`checks`) over it,
// parsed by Astro's compiler, and prints each branch with the rule's
// message. `pnpm lint` and the pre-commit hook run it after oxlint, on the
// paths they hand it; it skips any that isn't an .astro file.
//
// The frontmatter and <script>s stay oxlint's, so a branch there is reported
// once. With no scope analysis for the template, a name's `const` is found by
// its name across the file: one bound more than once (a `const`, a parameter,
// a destructured name) counts as unknown, as it does in the rule.

import { readFileSync } from "node:fs";
import { parse } from "@astrojs/compiler-rs";
import { children, fields, type Fields, type Node } from "./ast.ts";
import rule, { checks } from "./words-from-catalog.ts";

type At = { line: number; column: number };

// every node under `node`, itself first, but none in a <script> (oxlint's)
const nodesUnder = (node: Node): Fields[] =>
  node.type === "AstroScript"
    ? []
    : [
        node as Fields,
        ...children(node).flatMap(([, child]) => nodesUnder(child)),
      ];

// the names a pattern binds: `x`, `{ x, y: z }`, `[x, ...rest]`, `x = 1`
const namesIn = (value: unknown): string[] => {
  const node = fields(value);
  switch (node?.type) {
    case "Identifier":
      return [node.name as string];
    case "ObjectPattern":
      return (node.properties as Fields[]).flatMap((p) =>
        namesIn(p.type === "RestElement" ? p.argument : p.value),
      );
    case "ArrayPattern":
      return (node.elements as unknown[]).flatMap(namesIn);
    case "RestElement":
      return namesIn(node.argument);
    case "AssignmentPattern":
      return namesIn(node.left);
    default:
      return [];
  }
};

// the names a node binds, each with what a `const` set it to
const bindings = (node: Fields): [string, unknown][] => {
  switch (node.type) {
    case "VariableDeclaration":
      return (node.declarations as Fields[]).flatMap((declarator) =>
        namesIn(declarator.id).map((name): [string, unknown] => [
          name,
          node.kind === "const" && fields(declarator.id)?.type === "Identifier"
            ? declarator.init
            : undefined,
        ]),
      );
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return [node.id, ...(node.params as unknown[])]
        .flatMap(namesIn)
        .map((name) => [name, undefined]);
    case "CatchClause":
      return namesIn(node.param).map((name) => [name, undefined]);
    default:
      return [];
  }
};

// what each name was set to by a `const`, for a name bound once in the file
const constsOf = (nodes: Fields[]) => {
  const bound = new Map<string, unknown>();
  const twice = new Set<string>();
  for (const [name, init] of nodes.flatMap(bindings)) {
    if (bound.has(name)) twice.add(name);
    bound.set(name, init);
  }
  return (name: Fields) =>
    twice.has(name.name as string) ? undefined : bound.get(name.name as string);
};

// where each branch on the language that picks words in `source`'s markup
// starts, 1-based as oxlint prints it
export const markupBranches = (source: string): At[] => {
  const { ast } = parse(source);
  const frontmatter = fields(fields(ast.frontmatter)?.program);
  const markup = (ast.body as Node[]).flatMap(nodesUnder);
  const found: At[] = [];
  const visitors = checks(
    constsOf([...(frontmatter ? nodesUnder(frontmatter) : []), ...markup]),
    (node) => {
      const before = source.slice(0, (node as { start: number }).start);
      const lines = before.split("\n");
      found.push({ line: lines.length, column: lines.at(-1)!.length + 1 });
    },
  ) as Record<string, ((node: Node) => void) | undefined>;
  for (const node of markup) visitors[node.type]?.(node);
  return found;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  let count = 0;
  for (const path of process.argv.slice(2)) {
    if (!path.endsWith(".astro")) continue;
    for (const { line, column } of markupBranches(readFileSync(path, "utf8"))) {
      console.error(
        `${path}:${line}:${column}: empire(words-from-catalog): ${rule.meta.messages.branch}`,
      );
      count++;
    }
  }
  if (count > 0) {
    console.error(`Found ${count} in .astro markup.`);
    process.exitCode = 1;
  }
}
