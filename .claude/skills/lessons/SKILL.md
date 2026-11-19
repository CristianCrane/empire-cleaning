---
name: lessons
description: Notice what finished work cost and write each cost to the process layer's inbox as a raw signal, placing nothing. Use when work is done (the change skill's last step, before a PR leaves draft), when the user asks for lessons or a retro, or before they clear the session.
---

<!-- The change rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs. -->

# Lessons

What a piece of work cost is lost unless someone writes it down. This skill only **notices**: each cost goes to the process layer's inbox as a raw signal, and the curator decides, in a batch with every guidance file in view, what it teaches and where it lives (the dotfiles' `docs/process.md`). So write every cost, and place none: a rule written here would skip the curator's check of its place and its repeats.

## 1. Gather the costs

Walk the work: the conversation, the change skill's files beside the survey (the plan review and every round of the review), CI runs, commits that fix earlier ones. A **cost** is any of: the user corrected you; work was redone; a bug reached review, CI or the user; a claim was retracted; a dead end took more than a few tries; a gate turned you down.

Done when every review finding, every red run, every turn-down and every correction from the user is on the list.

## 2. Capture each

One signal per cost, from the PR's checkout, with the user's words when there are some:

```
node ~/.claude/hooks/capture.mjs --source lessons --kind <correction|retraction|cost> <<'EOF'
note: <the cost, and what it took>
said: <the user's words, if any>
proposed: <what you had done, if it matters>
EOF
```

The quoted heredoc keeps the words as written: in double quotes the shell would run a backtick span and expand a `$`.

Each run also adds the cost's line to the branch's lessons file (`- <cost> → inbox <id>`), the record the PR gate reads. Wide net: a small cost goes in too; the curator drops noise.

With no `~/.claude/hooks/capture.mjs` (a cloud session), open one issue on CristianCrane/.dotfiles, "Signals from <repo>: <branch>", listing the costs in your own words, with no quote of the user's and no name of a client or person: the repo is public, and raw signals stay local (D13). Then write the lessons file by hand, a line per cost: `- <cost> → <the issue's URL>`.

Done when every cost on the list has its line in the lessons file.

## 3. Close

The lessons file sits beside the review, at the review's path with `review` swapped for `lessons` (`review-fix-x.md` → `lessons-fix-x.md`); a turned-down `gh pr ready` names it. When the work cost nothing, write it by hand: `None: <why>`. A PR leaves draft (`gh pr ready`, or `gh pr create` without `--draft`) once this file says where every cost went and the review is of the last commit. Then tell the user how many signals went in.
