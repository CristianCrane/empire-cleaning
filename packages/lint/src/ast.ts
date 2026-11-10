// What every empire/ rule shares: oxlint's rule type and a node's shape

import type { RuleTester } from "oxlint/plugins-dev";

// oxlint's own types, which it exports only through RuleTester
export type Rule = Extract<
  Parameters<RuleTester["run"]>[1],
  { create: unknown }
>;
export type Node = { type: string };

export const isNode = (value: unknown): value is Node =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Node).type === "string";
