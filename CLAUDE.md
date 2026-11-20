## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Human tasks go on two lists

Don't open an issue for work only a person can do. Add it to one of two standing issues instead, as a checklist item that links the issue it unblocks:

- **#206 "Jen's to-do list"**: anything Jennifer, the owner, must check, answer or do: drafted copy, claims about how the business works, business questions, facts and photos, the Google Business Profile. Write it short and plain, with no glossary terms.
- **#205 "Manual setup"**: every other human task: accounts, secrets, DNS, dashboards, the domain switch, go-live steps. Every service account is made under the business Gmail, empirecleaningproservices@gmail.com, so there's one inbox to keep (2026-11-17).

An agent ticket that waits on one of them stays open, blocked by #205 or #206 (see **Blocking** in `docs/agents/issue-tracker.md`).

### Triage labels

The labels and what each means: `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`. When an ADR retires a pattern, it names the pattern; follow the newest ADR, as an older one can stand partly superseded (ADR-0018 over ADR-0014's commercial rules).

## UX

Before changing any screen, or writing words a person reads (a server message, an email), read `docs/ux.md`: the UX rules every screen keeps, how a new UX question is settled (prototype, pick, build, record), and the log of past decisions. Record each new decision there, and add a Storybook pattern (`packages/ui/src/Patterns.stories.tsx`) when a rule carries over to other screens.

A PR that changes a screen shows it before and after: `pnpm pr:shots <spec> "<test title>"` makes the screenshots and prints the table for the PR body (`packages/web/README.md`, Testing).

A screen never writes its own copy of a rule the server keeps (room, which Jobs a plan change replaces), not even as a hint: it shows the server's answer. A rule both run from `@empire-cleaning/models`, as the Suggested Price is, is the one copy, not a second. Two browser copies of room drifted from the server one after the other (#356, #365); the one left is the Schedule's drag (`hasRoomFor`, `packages/server/README.md`, Room).

## Tests

Before writing a test, changing how tests start, stop or wait, chasing one that fails or runs slow, or claiming what a build leaves out, read `docs/testing.md`: this repo's test rules, helpers and budgets. Before chasing a failure or timing a change, read `docs/testing-log.md`, the findings so far: the same failure has turned up twice already. Record each new finding there.

For the `change` skill, which says when each runs: the quick tests are `pnpm test:change`, naming the specs for the screens a change touches (`packages/web/README.md`), and the Checks (the CI table in `README.md`); the full suite is CI, on the PR (ADR-0026). Open the PR as a draft (`gh pr create --draft`) once the review leaves no change finding open and the quick tests pass, then watch it (`gh pr checks --watch`). A merge waits for the user's word, which they often give ahead ("merge when green", 2026-10-31). A newer push cancels the run still going, and a cancelled run isn't a failure but hides one: read `gh run list` conclusions (cancelled vs failure; 2026-10-27, when cancelled runs read as failed builds). Rerun what fails there locally and fix it; the fix gets its recheck before it's pushed, as one the full suite needs does (nothing gates a push to a draft). Mark the PR ready (`gh pr ready`) once every check is green and its lessons are written (the `lessons` skill).
