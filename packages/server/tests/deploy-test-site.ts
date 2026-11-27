// The test site's deploy, nightly and by hand (Actions → Deploy test site):
// each service in render.yaml is deployed at the newest commit on main whose
// CI passed, when that commit changes a file its buildFilter names, or its
// own settings there, since the service's last good deploy. Render's own
// auto-deploy is off on the test site, so the day's merges go out together,
// one build per changed service a night, not one per push, as Render's
// build minutes are capped.
//
//   pnpm --filter @empire-cleaning/server deploy:test-site [--dry-run]
//   pnpm --filter @empire-cleaning/server deploy:test-site live <service>
//
// It reads what's live from the deployments Render records on GitHub (in
// the environment "main - <service>"), and deploys through each service's
// deploy hook, pinned to that commit (render.com/docs/deploy-hooks), so a
// merge after CI's check can't ride along. A run fails when a deploy fails,
// or when Render records none for it, as the next run then couldn't tell
// what's live. `live` prints the commit a service last deployed well, for
// the Actions that must run the code the test site runs.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { matchesGlob } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  type BuildFilter,
  parseBlueprint,
  type Service,
} from "./render-blueprint.ts";

// Render's rule (render.com/docs/monorepo-support): a changed file builds a
// service when it matches an included path, or there are none, and no
// ignored path, as an ignored path wins. Node's globs pass over a dot-path
// under `**`; the test lists the few the repo has.
export const builds = (
  { paths = [], ignoredPaths = [] }: BuildFilter,
  files: string[],
) =>
  files.some(
    (file) =>
      (paths.length === 0 || paths.some((glob) => matchesGlob(file, glob))) &&
      !ignoredPaths.some((glob) => matchesGlob(file, glob)),
  );

export type Decision = { service: string; deploy: boolean; why: string };

// whether to deploy each service at `target`, given the commit each last
// deployed well (`live`)
export const decide = ({
  target,
  live,
  servicesAt,
  isAncestor,
  changed,
}: {
  target: string;
  live: Record<string, string | undefined>;
  // render.yaml's services as of a commit
  servicesAt: (sha: string) => Service[];
  // whether `a` is `b` or comes before it on its history
  isAncestor: (a: string, b: string) => boolean;
  // the paths a diff between two commits touches, both ends of a move
  changed: (from: string, to: string) => string[];
}): Decision[] =>
  servicesAt(target).map((service) => {
    const { name } = service;
    const decision = (deploy: boolean, why: string) => ({
      service: name,
      deploy,
      why,
    });
    const base = live[name];
    if (!base) return decision(true, "it has no good deploy on record");
    if (isAncestor(target, base))
      return decision(false, `${short(base)}, as new or newer, is live`);
    const before = servicesAt(base).find((each) => each.name === name);
    // a Blueprint sync may deploy this itself, at the merge; then it's live
    if (JSON.stringify(before) !== JSON.stringify(service))
      return decision(true, `its settings changed since ${short(base)}`);
    return builds(service.buildFilter ?? {}, changed(base, target))
      ? decision(true, `its files changed since ${short(base)}`)
      : decision(false, `none of its files changed since ${short(base)}`);
  });

const short = (sha: string) => sha.slice(0, 8);

// A deploy's GitHub record, newest first as GitHub lists them. Render may
// record a commit more than once (a retry, a deploy by hand), so a deploy
// just started is the one at its commit newer than the newest before it.
export type Recorded = { id: number; sha: string; state?: string };
export const outcome = (records: Recorded[], before: number, sha: string) => {
  const ours = records.find(
    (record) => record.id > before && record.sha === sha,
  );
  if (!ours) return "unrecorded";
  // success alone, as liveCommit counts it: Render has marked a deploy
  // inactive before it finished
  if (ours.state === "success") return "live";
  if (ours.state === "failure" || ours.state === "error") return "failed";
  return "going";
};

// the paths changed between two commits, both ends of a move (a page moved
// to e2e/ leaves the build)
export const changedFiles = (from: string, to: string, cwd?: string) =>
  run("git", ["diff", "--name-only", "--no-renames", from, to], cwd)
    .split("\n")
    .filter(Boolean);

const run = (command: string, args: string[], cwd?: string) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();

const REPO = process.env.GITHUB_REPOSITORY ?? "CristianCrane/empire-cleaning";
const gh = <T>(path: string) => JSON.parse(run("gh", ["api", path])) as T;

const records = (service: string) =>
  gh<{ id: number; sha: string }[]>(
    `repos/${REPO}/deployments?per_page=50&environment=${encodeURIComponent(`main - ${service}`)}`,
  );
const stateOf = (id: number) =>
  gh<{ state: string }[]>(
    `repos/${REPO}/deployments/${id}/statuses?per_page=1`,
  )[0]?.state;

// the commit a service last deployed well
const liveCommit = (service: string) =>
  records(service).find(({ id }) => stateOf(id) === "success")?.sha;

// the newest of main's last 50 merges whose CI run on main passed: CI's own
// run, not a check that only shares its name
const greenCommit = () =>
  run("git", ["rev-list", "--first-parent", "--max-count=50", "origin/main"])
    .split("\n")
    .find(
      (sha) =>
        gh<{ workflow_runs: { conclusion: string | null }[] }>(
          `repos/${REPO}/actions/workflows/ci.yml/runs?event=push&per_page=1&head_sha=${sha}`,
        ).workflow_runs[0]?.conclusion === "success",
    );

const isAncestor = (a: string, b: string) => {
  try {
    run("git", ["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch {
    return false;
  }
};

const servicesAt = (sha: string) =>
  parseBlueprint(run("git", ["show", `${sha}:render.yaml`])).services;

// each service's hook, as an environment variable named after it
const hookVariable = (service: string) =>
  `RENDER_DEPLOY_HOOK_${service.toUpperCase().replaceAll("-", "_")}`;

// The environment holding the hooks must take main's runs alone: GitHub
// makes one with no rules when a run names it first, and any branch's
// workflow could then read them
const ENVIRONMENT = "test-site-deploy";
const branchPolicy = () => {
  try {
    return gh<{
      deployment_branch_policy: { custom_branch_policies: boolean } | null;
    }>(`repos/${REPO}/environments/${ENVIRONMENT}`).deployment_branch_policy;
  } catch {
    // no such environment yet
    return null;
  }
};
const guarded = () => {
  if (!branchPolicy()?.custom_branch_policies) return false;
  const names = gh<{ branch_policies: { name: string }[] }>(
    `repos/${REPO}/environments/${ENVIRONMENT}/deployment-branch-policies`,
  ).branch_policies.map(({ name }) => name);
  return names.length === 1 && names[0] === "main";
};

// 202: queued behind a deploy already going, which Render records only once
// it starts
const trigger = async (hook: string, sha: string) => {
  const url = new URL(hook);
  url.searchParams.set("ref", sha);
  const response = await fetch(url, { method: "POST" });
  if (response.status === 200 || response.status === 202)
    return { queued: response.status === 202 };
  throw new Error(
    `Render refused the deploy hook: ${response.status} ${(await response.text()).slice(0, 200)}`,
  );
};

const MINUTE_MS = 60_000;
// Render records a deploy about a second after it starts, and a build takes
// up to about 3 minutes (the server's, the longest)
const RECORDED_WITHIN_MS = 3 * MINUTE_MS;
const DONE_WITHIN_MS = 20 * MINUTE_MS;

const waitFor = async (
  service: string,
  before: number,
  sha: string,
  queued: boolean,
) => {
  const started = Date.now();
  for (;;) {
    const result = outcome(
      records(service).map((record) => ({
        ...record,
        state: record.id > before ? stateOf(record.id) : undefined,
      })),
      before,
      sha,
    );
    const waited = Date.now() - started;
    if (result === "live") return;
    if (result === "failed")
      throw new Error(`${service}'s deploy of ${short(sha)} failed on Render`);
    if (result === "unrecorded" && !queued && waited > RECORDED_WITHIN_MS)
      throw new Error(
        `Render didn't record ${service}'s deploy on GitHub, so the next run can't tell what's live`,
      );
    if (waited > DONE_WITHIN_MS)
      throw new Error(
        result === "unrecorded"
          ? `${service}'s deploy, queued behind another on Render, hadn't started after 20 minutes`
          : `${service}'s deploy is still going after 20 minutes`,
      );
    await sleep(20_000);
  }
};

const say = (line: string) => {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
};

const fail = (lines: string[]) => {
  for (const line of lines) say(line);
  process.exitCode = 1;
};

const main = async (args: string[]) => {
  if (args[0] === "live") {
    const sha = liveCommit(args[1] ?? "");
    if (!sha) throw new Error(`${args[1]} has no good deploy on record`);
    console.log(sha);
    return;
  }
  const dryRun = args.includes("--dry-run");
  const target = greenCommit();
  if (!target)
    return fail([
      "None of main's last 50 merges passed CI, so nothing deploys: fix main's CI first.",
    ]);
  const decisions = decide({
    target,
    live: Object.fromEntries(
      servicesAt(target).map(({ name }) => [name, liveCommit(name)]),
    ),
    servicesAt,
    isAncestor,
    changed: changedFiles,
  });
  say(`Main's newest commit that passed CI: ${short(target)}`);
  for (const { service, deploy, why } of decisions)
    say(`- ${service}: ${deploy ? "deploys" : "stays"}, as ${why}`);
  const deploying = decisions.flatMap(({ service, deploy }) =>
    deploy ? [service] : [],
  );
  if (dryRun || deploying.length === 0) return;
  // every problem a run can see before it starts a deploy, at once
  const unset = deploying
    .map(hookVariable)
    .filter((variable) => !process.env[variable]);
  const limited = guarded();
  if (!limited || unset.length > 0)
    return fail([
      ...(limited
        ? []
        : [
            `The ${ENVIRONMENT} environment isn't limited to main, so its hooks aren't used: scripts/setup-test-site.sh's stage 9 sets it up (#205)`,
          ]),
      ...unset.map(
        (variable) =>
          `${variable} isn't set: it's ${ENVIRONMENT}'s secret, the service's deploy hook (#205)`,
      ),
    ]);
  const results = await Promise.allSettled(
    deploying.map(async (service) => {
      const before = records(service)[0]?.id ?? 0;
      const { queued } = await trigger(
        process.env[hookVariable(service)]!,
        target,
      ).catch((error: Error) => {
        throw new Error(`${service}: ${error.message}`);
      });
      await waitFor(service, before, target, queued);
    }),
  );
  const failed = results.flatMap((result) =>
    result.status === "rejected" ? [String(result.reason)] : [],
  );
  if (failed.length > 0) fail(failed);
  else say("Each deploy is live.");
};

if (import.meta.main) await main(process.argv.slice(2));
