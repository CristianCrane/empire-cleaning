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

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`. When an ADR retires a pattern, it names the pattern; follow the newest ADR.

## UX

Before changing any screen, read `docs/ux.md`: the UX rules every screen keeps, how a new UX question is settled (prototype, pick, build, record), and the log of past decisions. Record each new decision there, and add a Storybook pattern (`packages/ui/src/Patterns.stories.tsx`) when a rule carries over to other screens.

## Tests

Before writing a test, changing how tests start, stop or wait, or chasing one that fails or runs slow, read `docs/testing.md`: the rules every test, and every change to how they run, keeps, how a test question is settled (the cause shown first, timing on a quiet machine), and the log of past findings. Record each new finding there.

For the `change` skill, which says when each runs: the quick tests are `pnpm test:change`, naming the specs for the screens a change touches (`packages/web/README.md`), and the Checks (the CI table in `README.md`); the full suite is CI, on the PR (ADR-0026). Open the PR as a draft (`gh pr create --draft`) once the review leaves no change finding open and the quick tests pass, then watch it (`gh pr checks --watch`). Rerun what fails there locally and fix it; the fix gets its recheck before it's pushed, as one the full suite needs does (nothing gates a push to a draft). Mark the PR ready (`gh pr ready`) once every check is green.
