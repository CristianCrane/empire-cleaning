---
name: shape
description: Survey the patterns a code change touches before its first edit, get a fresh shape review before its PR, and write the PR's Shape section. Use when starting any change in a git repo, or when a hook asks for a survey or a review.
---

<!-- The shape rules: edited in github.com/CristianCrane/.dotfiles (home/.claude); repos carry copies made by hooks/sync.mjs. -->

# Shape

Each change leaves the codebase with less entropy, never more. Left alone, an agent judges this after its approach is already chosen, grades its own work, and extends whatever pattern is there because extending is the easy path. So the survey comes before the plan and holds facts, a fresh reviewer argues against the change, and extending is the choice that needs a reason.

A **pattern** is any shape the change follows or adds: a helper, a table, a layer, a test harness, a hook, a doc convention, a copy of code across packages.

## Rules

- **Ratchet.** A change may leave the code no simpler, but it never adds a third copy of a pattern, never bends a pattern that fights the change, and never edits one idea in many places (shotgun surgery: fold the idea into one place first).
- **The simplest shape is the plan.** When the survey finds a simpler shape than extending, build that. Extending instead takes a written reason, which goes in Shape.
- **One kind of work per PR**: a refactor, a behaviour change, or cleanups.
- **Refactor first.** A refactor that changes no behaviour, under ~10 files and inside one package: make it on its own branch and PR, then build the change on top of it. A bigger refactor, or one that crosses packages: stop and ask the user whether it goes first in its own PR or on its own issue.
- **Every change** gets a survey and a review. A small change writes a one-line survey.
- The repo's own rules (CLAUDE.md, ADRs) add to these.

## 1. Survey

Before the first edit (the survey gate turns edits down until it exists). Write it to:

```sh
git rev-parse --path-format=absolute --git-path "claude/survey-$(git branch --show-current | tr / -).md"
```

```
Change: <one line>
Patterns touched:
  - <name>: <n> copies — <path>, <path>, … — fits | fights the change
Simplest shape: <what> (~<n> files)
Plan: refactor first | extend — <the reason, when extend>
Expected files: <n>
```

Count copies by searching the repo for each pattern, not from memory. Done when every pattern the change touches is listed with every copy's path, and the simplest shape has a file count.

Post the survey in chat, then go on, unless the plan is a refactor big enough to ask about. On `main`, each commit needs a fresh survey.

## 2. Build

Keep the survey true: when the plan or the file count changes, update it. A hook compares the branch's size with `Expected files` every 25 files.

## 3. Review

After the last commit, before opening the PR (`gh pr create` is turned down until the review is newer than the last commit), run the `shape-reviewer` agent. Give it the branch, the repo root, and whether the branch is a refactor. It writes `claude/review-<branch>.md` beside the survey.

Fix or rebut each finding. A fix is a new commit, which makes the review stale: run the reviewer again. Done when the review is newer than the last commit and every finding has an answer.

## 4. Shape section

Every PR body ends with:

```
## Shape
- Extended | Retired | New: <pattern> — <paths>
- Simpler shape considered: <a real shape>; <why not, or "done in #N">
- Review: <finding> → fixed | rebutted: <why>
- Harder to change: <what, or nothing>
```

One line per pattern and per review finding. A refactor PR's Shape names what it retired and says how behaviour was shown unchanged.
