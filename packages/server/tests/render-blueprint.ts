// A Render Blueprint at the repo's root (render.yaml, render-production.yaml),
// as the parts the repo's own code reads: the Blueprints' test
// (src/render-blueprints.test.ts) and the test site's nightly deploy
// (tests/deploy-test-site.ts).
import { readFileSync } from "node:fs";
import { parse } from "yaml";

export type EnvVar = {
  key: string;
  value?: string;
  sync?: false;
  generateValue?: true;
  fromDatabase?: unknown;
};
// the files whose change deploys a service (render.com/docs/monorepo-support)
export type BuildFilter = { paths?: string[]; ignoredPaths?: string[] };
export type Service = {
  name: string;
  runtime: string;
  autoDeployTrigger?: string;
  buildFilter?: BuildFilter;
  envVars: EnvVar[];
};
type Database = { name: string; plan: string; ipAllowList?: unknown[] };
export type Blueprint = { databases: Database[]; services: Service[] };

export const parseBlueprint = (yaml: string) => parse(yaml) as Blueprint;

export const readBlueprint = (file: string) =>
  parseBlueprint(
    readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8"),
  );
