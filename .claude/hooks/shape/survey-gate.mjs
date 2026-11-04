// The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// Edits in a git checkout wait for the survey (the `shape` skill) and
// the reviewer's read of it: the edit is turned down until the survey
// names a path that exists and the plan review is written. Edits outside a
// checkout, inside the git dir (where those files live) and on a detached
// HEAD go through.
import { beforeEdit, cwdFor, deny, hook, inGitDir, workOf } from "./lib.mjs";

hook((input) => {
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!path) return;
  const cwd = cwdFor(input);
  if (inGitDir(cwd, path)) return;
  const work = workOf(cwd, input);
  if (!work) return;

  const { missing } = beforeEdit(cwd, work);
  if (missing) return deny(`Before this edit, ${missing}. The edit goes through once that's written.`);
});
