// The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// Edits in a git checkout wait for the branch's survey (the `shape`
// skill): the edit is turned down until the survey exists and names a
// path that exists. Edits outside a checkout, inside the git dir (the
// survey itself) and on a detached HEAD go through.
import { branchOf, cwdFor, deny, hook, inGitDir, survey } from "./lib.mjs";

hook((input) => {
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!path) return;
  const cwd = cwdFor(input);
  if (inGitDir(cwd, path)) return;
  const branch = branchOf(cwd);
  if (!branch) return;

  const found = survey(cwd, branch);
  if (found.ok) return;
  return deny(
    `No survey for branch ${branch} (${found.reason}). Load the \`shape\` skill and write its survey to ${found.path} before the first edit. This edit goes through once the survey names a path that exists.`,
  );
});
