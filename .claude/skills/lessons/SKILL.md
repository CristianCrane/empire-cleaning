---
name: lessons
description: Turn what finished work cost into lessons, each written where every agent that needs it will load it, pruning what it replaces. Use when work is done (the change skill's last step, before a PR leaves draft or a push to main), when the user asks for lessons or a retro, or before they clear the session.
---

<!-- The change rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs. -->

# Lessons

What a session learns dies with it unless it's written where the next agent looks. Auto memory reaches only main sessions in one repo: subagents and other projects never load it. So each **lesson** goes to the narrowest place that every agent needing it loads, and whatever it replaces goes.

## 1. Gather the costs

Walk the work: the conversation, the change skill's files beside the survey (the plan review and every round of the review), CI runs, commits that fix earlier ones. List every **cost**: the user corrected you; work was redone; a bug reached review, CI or the user; a claim was retracted; a dead end took more than a few tries.

Done when every review finding, every red run and every correction from the user is on the list.

## 2. Keep the lessons

A cost is a lesson only when all four hold:

- **It recurs:** it would happen again in other work. A fact about this ticket alone is not a lesson.
- **It's unrecorded:** search the code, its comments, the docs, git history and the existing rules first. Recorded already is not a lesson.
- **It changes behaviour:** it reads as "when X, do Y", with why.
- **It's foundational:** it changes how work is approached, across many changes. A small slip that cost one quick fix, a fact about one helper, or a workaround for a tool's snag isn't a lesson, even if it recurs (the snag itself goes to a fix, below). Few lessons, each one heavy: a list of minor ones is noise nobody reads.

Done when each cost is a lesson in that form or ruled out with its reason.

## 3. Route each lesson

Sort it first:

- **Mechanical** (a fixed pattern, a banned call, a file-location rule, or a snag that keeps costing: a refused command, a gate that misreads, a missing tool): a deterministic check (a lint rule, a hook, a test, a CI job), or a fix at the snag's source (the config, the hook, the package), so nobody has to remember a way around it. It's never written down as a workaround. It's a change of its own: propose it to the user, and it went to their answer (the change that built it, or the issue that holds it). A workaround line that must stay meanwhile names that issue ("until <issue>") and goes when it lands; one whose source isn't ours to fix says so.
- **A miss the review should have caught:** a rule for the reviewer agent.
- **A judgement call:** prose, in the narrowest place every agent that needs it loads:

| The lesson holds for | It goes to |
|---|---|
| every project | the global CLAUDE.md (`~/.dotfiles/home/.claude/CLAUDE.md`) |
| this repo, any agent | the repo's CLAUDE.md, or a doc it points at (a findings log, a decisions log) |
| this repo, its main sessions only (current work, a preference about this repo) | auto memory |

**Global lessons** (the global CLAUDE.md, the change rules, the reviewer) load in every session, so the user approves them first. Then make them all as one change in `~/.dotfiles` (the change skill, straight to main), when that checkout is on a clean main; when the work is itself a dotfiles branch, they ride its lessons commit. Otherwise (another branch there, uncommitted changes, or no `~/.dotfiles`, as in a cloud session) open one issue on CristianCrane/.dotfiles, "Lessons from <repo>: <branch>", holding them: that issue is where they went.

**Repo lessons** on a PR's branch go in one cleanup commit on it, "Lessons: …", which gets the change skill's recheck like any cleanup.

Done when every lesson has a place it went.

## 4. Prune

Read each place you wrote. A line the lesson replaces, contradicts or makes stale goes in the same edit, as does a memory whose fact is now fixed or recorded elsewhere.

Done when no two places hold one lesson.

## 5. Write the lessons file

Write it beside the review, as `lessons-<branch>.md` with each `/` in the branch's name as `-` (`git rev-parse --path-format=absolute --git-path claude/lessons-fix-x.md` for `fix/x`); a turned-down `gh pr ready` names it too:

```
Lessons for <branch>:
- <when X, do Y> → <where it went: a commit, a file, an issue, a memory>
```

or `None: <what it cost, and why none of it is a lesson>`. A PR leaves draft (`gh pr ready`, or `gh pr create` without `--draft`) once this file says where every lesson went and the review is of the last commit (after a lessons commit, its recheck). Then show the user each lesson and where it went.
