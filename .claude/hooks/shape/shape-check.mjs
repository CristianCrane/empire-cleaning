// The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// After each edit, counts the files the current branch changes against
// the default branch. Each time the count crosses another 25, the agent is
// told once to step back and compare with the survey's Expected files.
// Changes made before the survey and its plan review (a Bash edit slips
// past the survey gate) are pointed out once per commit. A nudge, never a
// block.
import { readFileSync, writeFileSync } from "node:fs";
import { beforeEdit, changedFiles, cwdFor, git, hook, stateFile, workOf } from "./lib.mjs";

const STEP = 25;

const say = (text) => ({
  systemMessage: text.split(". ")[0] + ".",
  hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text },
});

hook((input) => {
  const cwd = cwdFor(input);
  const work = workOf(cwd, input);
  if (!work) return;
  const { branch } = work;

  const { survey: found, missing } = beforeEdit(cwd, work);
  const files = changedFiles(cwd);
  if (files.size === 0) return;

  // per worktree: what this work was already told
  const marker = stateFile(cwd, "shape-check", work.key);
  let told = { step: 0, unsurveyedAt: null };
  try {
    told = { ...told, ...JSON.parse(readFileSync(marker, "utf8")) };
  } catch {}

  const head = git(cwd, "rev-parse", "HEAD");
  if (missing && told.unsurveyedAt !== head) {
    writeFileSync(marker, JSON.stringify({ ...told, unsurveyedAt: head }));
    return say(
      `Branch ${branch} changes ${files.size} files, but ${missing}. Do that now, before going on.`,
    );
  }

  const reached = Math.floor(files.size / STEP);
  if (reached <= told.step) return;
  writeFileSync(marker, JSON.stringify({ ...told, step: reached }));

  const planned = found.expected ? ` Its survey expected ${found.expected}.` : "";
  return say(
    `Branch ${branch} now changes ${files.size} files.${planned} Step back, as the \`shape\` skill asks: is this shotgun surgery, a third copy of a pattern, or a pattern fighting the change? If it is, tell the user now: what the pattern costs, the simpler shape, and how to split the work. Otherwise update the survey's plan and Expected files, and say in the PR's Shape section why it grew.`,
  );
});
