import { describe, expect, test } from "vitest";
import {
  type Blueprint,
  type EnvVar,
  readBlueprint,
} from "../tests/render-blueprint.ts";
import { envSchema } from "./env.ts";

// The test site (render.yaml) and production (render-production.yaml) are two
// Render Blueprints, as one file would deploy production on every merge
// (ADR-0020). Render can't share settings between them, so production is
// the test site with the differences below, and nothing else: a setting
// changed in one file and not the other fails here.

const testSite = readBlueprint("render.yaml");
const production = readBlueprint("render-production.yaml");

// every way production differs from the test site
const asProduction = (site: Blueprint): Blueprint => {
  // its own names and addresses, wherever they're named: domains, origins,
  // the database a server reads, where the web app forwards /api
  const renamed = JSON.parse(
    JSON.stringify(site)
      .replaceAll("empire-test-", "empire-prod-")
      .replaceAll(
        "app.test.empirecleaningandpro.com",
        "app.empirecleaningandpro.com",
      )
      .replaceAll(
        "test.empirecleaningandpro.com",
        "www.empirecleaningandpro.com",
      ),
  ) as Blueprint;
  const values: Record<string, string> = {
    APP_MODE: "prod",
    VITE_APP_MODE: "prod",
    PUBLIC_APP_MODE: "prod",
    EMAIL_FROM: "Empire Cleaning <no-reply@empirecleaningandpro.com>",
  };
  // the test site's alone: production emails anyone
  const testOnly = ["EMAIL_ALLOWED"];
  const productionOnly: Record<string, EnvVar[]> = {
    // Cloudflare Web Analytics counts production's visits only
    "empire-prod-landing": [
      {
        key: "PUBLIC_CF_ANALYTICS_TOKEN",
        value: "e1c9a5e3ae014527a7c226b3d9d8e606",
      },
    ],
  };
  return {
    databases: renamed.databases.map((database) => ({
      ...database,
      // its own plan, for the backups it keeps (#205)
      plan: production.databases.find(({ name }) => name === database.name)!
        .plan,
      // reachable only from inside Render: the test site's is open only so
      // the reset Action can reach it
      ipAllowList: [],
    })),
    services: renamed.services.map((service) => ({
      ...service,
      // released by hand, never on a merge, so no build filter: one would
      // never fire
      autoDeployTrigger: "off",
      buildFilter: undefined,
      envVars: [
        ...service.envVars
          .filter(({ key }) => !testOnly.includes(key))
          .map((variable) =>
            variable.key in values
              ? { ...variable, value: values[variable.key] }
              : variable,
          ),
        ...(productionOnly[service.name] ?? []),
      ],
    })),
  };
};

test("production is the test site, but for the differences listed here", () => {
  expect(production).toEqual(asProduction(testSite));
});

// each Blueprint's server has what pnpm env:check needs, and nothing it
// doesn't read
describe.each([
  ["render.yaml", testSite],
  ["render-production.yaml", production],
])("%s's server", (_file, site) => {
  const server = site.services.find(({ runtime }) => runtime === "node")!;

  test("sets only what the server reads", () => {
    const known = Object.keys(envSchema.in.shape);
    expect(
      server.envVars
        .map(({ key }) => key)
        .filter((key) => !known.includes(key)),
    ).toEqual([]);
  });

  // a secret, generated or database value is entered on Render, so the
  // tests' stand-in takes its place; a value written in the Blueprint is
  // checked as it is
  test("starts with what it sets", () => {
    const standIns: Record<string, string | undefined> = {
      ...process.env,
      SENTRY_DSN: "https://key@o1.ingest.sentry.io/1",
    };
    const env = Object.fromEntries(
      server.envVars.map(({ key, value }) => [key, value ?? standIns[key]]),
    );
    expect(envSchema.safeParse(env).error?.issues ?? []).toEqual([]);
  });
});
