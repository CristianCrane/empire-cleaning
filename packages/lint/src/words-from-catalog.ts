// empire/words-from-catalog (#388, ADR-0025): words that differ by language
// come from a catalog (`catalog()`, packages/models/src/language.ts), looked
// up by the language (`words[lang]`), never a branch on it. A branch skips
// the typecheck that fails the build on a missing Spanish string, and its
// plurals skip `formats[lang].plural`.
//
// A JS plugin gets no types, so the rule knows a language by what it's
// compared with: a language code (`LANGUAGES`), either way round, with
// `===`, `!==`, `==` or `!=`, under any name (`lang`, `email.lang`,
// `currentLanguage()`), or a `const` set to such a comparison. It flags a
// ternary, `&&`, `||`, `if` or `switch` on one when a branch holds words: a
// string, template or JSX text anywhere under it with a letter, that isn't
// a language code. Picking the other language (`lang === "en" ? "es" :
// "en"`) holds none. What a branch compares with, an object's key, a
// member's name and a type aren't words.
//
// It can't see a language compared with anything but a code
// (`lang === other`, `lang.startsWith("es")`), a boolean kept by `let` or
// passed in (`isSpanish`), or words a branch reaches through a call
// (`lang === "es" ? spanish() : english()`). Being deep, it flags a string
// that isn't words under a branch on the language too (an Intl option, a
// class name): those go in a table by language as well (`locales`).

import { LANGUAGES } from "@empire-cleaning/models";
import { children, fields, type Fields, type Rule } from "./ast.ts";

const isCode = (value: unknown) =>
  (LANGUAGES as readonly unknown[]).includes(value);

const equality = new Set(["===", "!==", "==", "!="]);

const isComparison = (node: Fields) =>
  node.type === "BinaryExpression" && equality.has(node.operator as string);

// a literal's text: a string, or a template with nothing put in it
const textOf = (value: unknown): string | undefined => {
  const node = fields(value);
  if (node?.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node?.type === "TemplateLiteral") {
    const { quasis, expressions } = node as unknown as {
      quasis: { value: { cooked: string | null } }[];
      expressions: unknown[];
    };
    if (expressions.length === 0) return quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
};

const isWord = (text: string | null | undefined) =>
  !!text && /\p{L}/u.test(text) && !isCode(text);

// fields that hold types, never words a person reads
const types = new Set([
  "typeAnnotation",
  "typeArguments",
  "typeParameters",
  "returnType",
]);

// whether `value`, a node or a list of them, holds words anywhere under it
const holdsWords = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(holdsWords);
  const node = fields(value);
  if (!node || isComparison(node)) return false;
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" && isWord(node.value);
    case "TemplateElement":
      return isWord((node.value as { cooked: string | null }).cooked);
    case "JSXText":
      return isWord(node.value as string);
  }
  return children(node).some(
    ([field, child]) =>
      !types.has(field) &&
      !(field === "key" && node.type === "Property" && !node.computed) &&
      !(field === "property" && node.type === "MemberExpression") &&
      holdsWords(child),
  );
};

// the rule's checks, as visitors, wherever the nodes come from: oxlint's
// rule below, and an .astro file's markup (astro-markup.ts). `constOf` gives
// what a name (an Identifier) was set to by its one `const`, or undefined;
// `report` hears each branch that picks words
export const checks = (
  constOf: (name: Fields) => unknown,
  report: (node: unknown) => void,
): ReturnType<Rule["create"]> => {
  // whether `value`, a test, compares a language with a code: itself, in
  // `&&`, `||` or `!`, or through a `const` set to one
  const comparesLanguage = (value: unknown): boolean => {
    const node = fields(value);
    switch (node?.type) {
      case "BinaryExpression":
        return (
          isComparison(node) &&
          (isCode(textOf(node.left)) || isCode(textOf(node.right)))
        );
      case "LogicalExpression":
        return comparesLanguage(node.left) || comparesLanguage(node.right);
      case "UnaryExpression":
        return node.operator === "!" && comparesLanguage(node.argument);
      case "Identifier":
        return comparesLanguage(constOf(node));
      default:
        return false;
    }
  };

  return {
    ConditionalExpression(node) {
      if (
        comparesLanguage(node.test) &&
        holdsWords([node.consequent, node.alternate])
      )
        report(node);
    },
    IfStatement(node) {
      if (
        comparesLanguage(node.test) &&
        holdsWords([node.consequent, node.alternate])
      )
        report(node);
    },
    LogicalExpression(node) {
      if (
        node.operator !== "??" &&
        comparesLanguage(node.left) &&
        holdsWords(node.right)
      )
        report(node);
    },
    SwitchStatement(node) {
      const onLanguage = node.cases.some(
        ({ test }) => isCode(textOf(test)) || comparesLanguage(test),
      );
      if (onLanguage && holdsWords(node.cases.map((c) => c.consequent)))
        report(node);
    },
  };
};

const rule = {
  meta: {
    type: "problem" as const,
    docs: {
      description:
        "Words that differ by language come from a catalog, never a branch on the language (packages/lint/README.md)",
    },
    schema: [],
    messages: {
      branch:
        "Words that differ by language go in a catalog (`catalog()`, packages/models/src/language.ts), looked up by the language (`words[lang]`), not picked by a branch on it.",
    },
  },
  create(context) {
    return checks(
      (name) => {
        let scope: ReturnType<typeof context.sourceCode.getScope> | null =
          context.sourceCode.getScope(name as never);
        while (scope && !scope.set.has(name.name as string))
          scope = scope.upper;
        const defs = scope?.set.get(name.name as string)?.defs ?? [];
        const def = defs.length === 1 ? defs[0] : undefined;
        if (def?.type !== "Variable") return undefined;
        const { kind } = def.parent as unknown as { kind: string };
        const { init } = def.node as unknown as { init: unknown };
        return kind === "const" ? init : undefined;
      },
      (node) => context.report({ node: node as never, messageId: "branch" }),
    );
  },
} satisfies Rule;

export default rule;
