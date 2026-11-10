// What every empire/ rule shares: oxlint's rule type, and how a rule reads
// a node and walks its children

import type { RuleTester } from "oxlint/plugins-dev";

// oxlint's own types, which it exports only through RuleTester
export type Rule = Extract<
  Parameters<RuleTester["run"]>[1],
  { create: unknown }
>;
export type Node = { type: string };

// a node with its fields, read as a rule needs them
export type Fields = Node & Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Node).type === "string";

// `value` as a node with its fields, or undefined when it isn't a node
export const fields = (value: unknown): Fields | undefined =>
  isNode(value) ? (value as Fields) : undefined;

// a node's children, each with the field it's in; never its parent
export const children = (node: Node): [field: string, child: Node][] =>
  Object.entries(node).flatMap(([field, value]) =>
    field === "parent"
      ? []
      : (Array.isArray(value) ? value : [value])
          .filter(isNode)
          .map((child): [string, Node] => [field, child]),
  );
