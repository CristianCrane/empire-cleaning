// The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// Edits in a git checkout wait for the survey (the `shape` skill) and
// the reviewer's read of it: the edit is turned down until the survey
// names a path that exists and the plan review is written. Edits outside a
// checkout, inside the git dir (where those files live) and on a detached
// HEAD go through.
import { cwdFor, deny, hook, inGitDir, planReview, survey, workOf } from "./lib.mjs";

hook((input) => {
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!path) return;
  const cwd = cwdFor(input);
  if (inGitDir(cwd, path)) return;
  const work = workOf(cwd, input);
  if (!work) return;

  const found = survey(cwd, work.key);
  if (!found.ok)
    return deny(
      `No survey for ${work.branch} (${found.reason}). Load the \`shape\` skill and write its survey to ${found.path} before the first edit. This edit goes through once the survey names a path that exists and the reviewer has read it.`,
    );
  const plan = planReview(cwd, work.key);
  if (!plan.ok)
    return deny(
      `The survey for ${work.branch} has no plan review yet. Run the shape-reviewer agent on it as the \`shape\` skill's Plan review step says, with survey ${found.path} and output ${plan.path}. This edit goes through once that file exists.`,
    );
});
