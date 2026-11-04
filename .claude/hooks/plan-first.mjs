// Before the first edit on a branch, the agent says which files the change
// touches and why (CLAUDE.md, "Shape of the code"). That first edit is
// turned down once with the request; the retry goes through. Any failure
// here lets the edit through.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!path) process.exit(0);
  // the nearest folder that exists: a new file's own may not yet
  let cwd = dirname(path);
  while (!existsSync(cwd)) cwd = dirname(cwd);

  const branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  if (branch === "main" || branch === "HEAD") process.exit(0);

  // per worktree: the branches whose plan was asked for
  const marker = git(
    cwd,
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    "claude-plan-first",
  );
  let asked = [];
  try {
    asked = readFileSync(marker, "utf8").split("\n").filter(Boolean);
  } catch {}
  if (asked.includes(branch)) process.exit(0);
  writeFileSync(marker, [...asked, branch].join("\n") + "\n");

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `First edit on branch ${branch}. Before it, tell the user in a few lines which files this change will touch and why (CLAUDE.md, "Shape of the code"). If that is shotgun surgery, a third copy of a pattern, or a pattern fighting the change, stop there and ask how to split the work. Otherwise go on: this edit goes through when you retry it.`,
      },
    }),
  );
} catch {
  // not a git checkout or bad input: let the edit through
}
