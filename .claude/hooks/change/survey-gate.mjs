// The change rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// Edits in a git checkout wait for the survey (the `change` skill) and
// the reviewer's read of it: the edit is turned down until the survey
// names a path that exists and the plan review is written, or the survey
// is a dictated one that holds with this edit made (lib's dictatedHolds).
// Edits outside a checkout, inside the git dir (where those files live)
// and on a detached HEAD or a prototype branch (lib's prototypeBranch) go
// through.
import { existsSync, readFileSync } from "node:fs";
import { beforeEdit, cwdFor, deny, hook, inGitDir, workOf } from "./lib.mjs";

// the file's text once this edit is made: Write's content, or Edit's and
// MultiEdit's replacements applied to the file as it is
const after = (path, { content, old_string, new_string, replace_all, edits }) => {
  if (content !== undefined) return content;
  let text = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const one of edits ?? [{ old_string, new_string, replace_all }])
    text = one.replace_all ? text.split(one.old_string).join(one.new_string) : text.replace(one.old_string, () => one.new_string);
  return text;
};

hook((input) => {
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!path) return;
  const cwd = cwdFor(input);
  if (inGitDir(cwd, path)) return;
  const work = workOf(cwd, input);
  if (!work) return;

  // a notebook's edit has no text to read: its path alone counts it in the change
  const pending = { path, content: input.tool_input.file_path ? after(path, input.tool_input) : undefined };
  const { missing } = beforeEdit(cwd, work, input, pending);
  if (missing) return deny(`Before this edit, ${missing}. The edit goes through once that's written.`);
});
