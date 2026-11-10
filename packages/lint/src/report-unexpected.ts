// empire/report-unexpected (#351): every error a screen catches but didn't
// expect goes to Sentry. A `catch` clause, a `.catch(handler)` and the
// second handler of a `.then(ok, handler)` each throw, or call one of the
// package's reporters (the rule's `reporters` option, set per package in
// .oxlintrc.json), which skips what's expected. A handler passed by name
// passes when it's a reporter. A call anywhere in the handler counts, but
// not one inside a function the handler makes, which may never run.
//
// A catch that only ever expects its throw (blocked storage) says so:
//   // oxlint-disable-next-line empire/report-unexpected -- <why>

import { children, fields, type Node, type Rule } from "./ast.ts";

const isFunction = (node: Node) =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionExpression" ||
  node.type === "FunctionDeclaration";

// whether `node` throws or calls a reporter, outside any function it makes
const handles = (node: Node, reporters: string[]): boolean => {
  if (node.type === "ThrowStatement") return true;
  if (node.type === "CallExpression") {
    const callee = fields(fields(node)!.callee);
    if (
      callee?.type === "Identifier" &&
      reporters.includes(callee.name as string)
    )
      return true;
  }
  return children(node).some(
    ([, child]) => !isFunction(child) && handles(child, reporters),
  );
};

// a handler given to .catch or .then
const handlerHandles = (handler: Node, reporters: string[]) => {
  const { name, body } = fields(handler)!;
  return handler.type === "Identifier"
    ? reporters.includes(name as string)
    : isFunction(handler) && handles(body as Node, reporters);
};

const rule = {
  meta: {
    type: "problem" as const,
    docs: {
      description:
        "A caught error is reported unless it was expected (packages/lint/README.md)",
    },
    schema: [
      {
        type: "object",
        properties: {
          reporters: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unreported:
        "This catch hides errors it didn't expect. {{fix}}; a throw that's always expected takes `// oxlint-disable-next-line empire/report-unexpected -- <why>`.",
    },
  },
  create(context) {
    const { reporters = [] } = (context.options[0] ?? {}) as {
      reporters?: string[];
    };
    // a package with no reporter (ui) can only rethrow
    const data = {
      fix: reporters.length
        ? `Call ${reporters.join(" or ")} with the error, or rethrow it`
        : "Rethrow it",
    };
    const unreported = (node: { range: [number, number] }) =>
      context.report({ node, messageId: "unreported", data });

    return {
      CatchClause(node) {
        if (!handles(node.body, reporters)) unreported(node);
      },
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== "MemberExpression") return;
        const name =
          callee.property.type === "Identifier" ? callee.property.name : "";
        const handler =
          name === "catch"
            ? node.arguments[0]
            : name === "then"
              ? node.arguments[1]
              : undefined;
        if (handler && !handlerHandles(handler, reporters)) unreported(handler);
      },
    };
  },
} satisfies Rule;

export default rule;
