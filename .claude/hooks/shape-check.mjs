// After each edit, counts the files the current branch changes against
// main. Each time the count crosses another 25, the agent is told once to
// step back (CLAUDE.md, "Shape of the code"). A nudge, never a block: any
// failure here stays silent.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const STEP = 25;

const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

const lines = (text) => text.split("\n").filter(Boolean);

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  // the edited file's own checkout, so an edit in a worktree counts that
  // worktree's branch
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  const cwd = path ? dirname(path) : input.cwd;

  const branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  if (branch === "main" || branch === "HEAD") process.exit(0);
  const base = git(cwd, "merge-base", "HEAD", "origin/main");

  const files = new Set([
    ...lines(git(cwd, "diff", "--name-only", base)),
    ...lines(git(cwd, "ls-files", "--others", "--exclude-standard")),
  ]);
  const reached = Math.floor(files.size / STEP);
  if (reached === 0) process.exit(0);

  // per worktree: the branch and the last step it was told about
  const marker = git(
    cwd,
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    "claude-shape-check",
  );
  let told = 0;
  try {
    const [onBranch, step] = readFileSync(marker, "utf8").split(" ");
    if (onBranch === branch) told = Number(step) || 0;
  } catch {}
  if (reached <= told) process.exit(0);
  writeFileSync(marker, `${branch} ${reached}`);

  console.log(
    JSON.stringify({
      systemMessage: `Branch ${branch} now changes ${files.size} files against main.`,
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `Branch ${branch} now changes ${files.size} files against main. Step back, as CLAUDE.md's "Shape of the code" asks: is this shotgun surgery, a third copy of a pattern, or a pattern fighting the change? If it is, tell the user now, before going on: what the pattern costs, the simpler shape, and how to split the work (the refactor first, in its own PR). If the size is honest, say why in the PR's Shape section.`,
      },
    }),
  );
} catch {
  // not a git checkout, no origin/main, or bad input: nothing to say
}
