// empire/screen-layout (#431, ADR-0031): a screen renders through the
// layout for its type (docs/ux.md, Screen types), never building its own
// page from the kit's parts. It flags each of the page's parts a screen
// places itself:
//
// - `Breadcrumbs` and `ActionFooter`, from the kit (@empire-cleaning/ui),
//   under whatever name they're imported as, or through `import * as`
// - the page's title: the kit's `Heading` at `level={1}`, or an `<h1>`
// - the facts grid: a `<dl>` laid out as a grid (`grid` among its class
//   names), but for two columns of amounts (`grid-cols-[1fr_auto]`), a
//   receipt rather than facts
//
// The layouts that place them live in the kit (packages/ui/src/layouts/),
// where the rule doesn't run (.oxlintrc.json): that's its allowed set, so a
// new layout changes nothing here.
//
// It can't see a level that isn't written as 1 (`level={level}`, a spread),
// class names made by a call (`cn(…)`), or a part a screen reaches
// through a component of the kit's that isn't a layout. A component in the
// screens' own folders (BillParts.tsx, a dialog) is checked where it is.

import { fields, type Fields, type Rule } from "./ast.ts";

const KIT = "@empire-cleaning/ui";

// the kit's components that are the page's parts, and what the warning
// calls each
const PARTS: Record<string, string> = {
  Breadcrumbs: "its breadcrumbs",
  ActionFooter: "its bar at the foot (ActionFooter)",
};
const TITLE = "its title (an h1)";

// a string attribute's text: "…", {"…"} or {`…`} with nothing put in it
const textOf = (value: unknown): string | undefined => {
  const node = fields(value);
  if (node?.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node?.type === "JSXExpressionContainer") return textOf(node.expression);
  if (node?.type === "TemplateLiteral" && !(node.expressions as []).length)
    return (node.quasis as Fields[])
      .map((q) => (q.value as { cooked: string }).cooked)
      .join("");
  return undefined;
};

const attribute = (element: Fields, name: string) =>
  (element.attributes as Fields[]).find(
    (a) =>
      a.type === "JSXAttribute" &&
      fields(a.name)?.type === "JSXIdentifier" &&
      fields(a.name)!.name === name,
  );

const isLevelOne = (element: Fields) => {
  const value = fields(attribute(element, "level")?.value);
  const expression = fields(value?.expression);
  return expression?.type === "Literal" && expression.value === 1;
};

const isFactsGrid = (element: Fields) => {
  const classes = (textOf(attribute(element, "className")?.value) ?? "").split(
    /\s+/,
  );
  return classes.includes("grid") && !classes.includes("grid-cols-[1fr_auto]");
};

const rule = {
  meta: {
    type: "suggestion" as const,
    docs: {
      description:
        "A screen renders through the layout for its type (packages/lint/README.md)",
    },
    messages: {
      ownPart:
        "This screen places {{part}} itself, rather than through the layout for its type (docs/ux.md, Screen types).",
      ownFacts:
        "This screen lays out a facts grid by hand, which is the kit's to lay out (docs/ux.md, Screen types, Record).",
    },
  },
  create(context) {
    // each kit part's local name, and the kit's namespace's
    const local = new Map<string, string>();
    const namespaces = new Set<string>();

    // the kit's component an element's name is, if any
    const kitName = (name: Fields): string | undefined => {
      if (name.type === "JSXIdentifier") return local.get(name.name as string);
      if (name.type === "JSXMemberExpression") {
        const object = fields(name.object)!;
        const property = fields(name.property)!;
        if (
          object.type === "JSXIdentifier" &&
          namespaces.has(object.name as string)
        )
          return property.name as string;
      }
      return undefined;
    };

    return {
      ImportDeclaration(node) {
        if (node.source.value !== KIT) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier")
            namespaces.add(specifier.local.name);
          else if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier"
          )
            local.set(specifier.local.name, specifier.imported.name);
        }
      },
      JSXOpeningElement(node) {
        const element = node as unknown as Fields;
        const name = fields(element.name)!;
        const kit = kitName(name);
        const intrinsic =
          name.type === "JSXIdentifier" ? (name.name as string) : undefined;
        const part =
          kit && kit in PARTS
            ? PARTS[kit]
            : (kit === "Heading" && isLevelOne(element)) || intrinsic === "h1"
              ? TITLE
              : undefined;
        if (part)
          context.report({ node, messageId: "ownPart", data: { part } });
        else if (intrinsic === "dl" && isFactsGrid(element))
          context.report({ node, messageId: "ownFacts" });
      },
    };
  },
} satisfies Rule;

export default rule;
