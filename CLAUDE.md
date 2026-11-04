## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Human tasks go on two lists

Don't open an issue for work only a person can do. Add it to one of two standing issues instead, as a checklist item that links the issue it unblocks:

- **#206 "Jen's to-do list"**: anything Jennifer, the owner, must check, answer or do: drafted copy, claims about how the business works, business questions, facts and photos, the Google Business Profile. Write it short and plain, with no glossary terms.
- **#205 "Manual setup"**: every other human task: accounts, secrets, DNS, dashboards, the domain switch, go-live steps.

An agent ticket that waits on one of them stays open, blocked by #205 or #206 (see **Blocking** in `docs/agents/issue-tracker.md`).

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## UX

Before changing any screen, read `docs/ux.md`: the UX rules every screen keeps, how a new UX question is settled (prototype, pick, build, record), and the log of past decisions. Record each new decision there, and add a Storybook pattern (`packages/ui/src/Patterns.stories.tsx`) when a rule carries over to other screens.

## Shape of the code

Before the first edit on a branch, tell the user which files the change touches and why. When that is shotgun surgery (one idea edited in many places), the third copy of a pattern, or a pattern fighting the change, stop and name it: what it costs, and the simpler shape. Make the change easy, then make the easy change: the refactor goes first, in its own PR that changes no behaviour, or on its own issue when it's bigger than the feature. The user picks which. Each PR holds one kind of work: a refactor, a behaviour change, or cleanups.

When an ADR retires a pattern, it names the pattern; follow the newest ADR.

Every PR body ends with **Shape**: the patterns the change extended or retired, and anything now harder to change.

Two hooks in `.claude/settings.json` back this up: the first edit on a branch is turned down once with the request above, and each time a branch passes another 25 changed files the agent is told to step back.
