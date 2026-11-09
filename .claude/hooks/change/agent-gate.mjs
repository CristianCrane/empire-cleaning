// The change rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs.
//
// An agent isn't spawned into a harness-isolated worktree (`isolation:
// "worktree"`). There the Write tool refuses the git dir, where the
// `change` skill's files live, and every powershell.exe command is refused
// as one that might run git; each isolated agent kept its own list of
// workarounds (CristianCrane/.dotfiles#11, #12, #13). An agent that makes
// its own git worktree meets neither refusal.
import { deny, hook } from "./lib.mjs";

hook((input) => {
  if (input.tool_input?.isolation !== "worktree") return;
  return deny(
    "An agent in a harness-isolated worktree can't write the `change` skill's files (the harness refuses the git dir, where they live), nor run PowerShell. Spawn it without `isolation`, and have its first step make its own worktree from the repo it works on: `git worktree add ../<repo>-<branch> -b <branch> origin/main`. Its shell starts in this session's folder on every call, so tell it to begin each command with `cd <its worktree> &&` and to name files there by absolute path.",
  );
});
