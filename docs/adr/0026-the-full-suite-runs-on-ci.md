# The full suite runs on CI, not locally

Every PR ran the full suite (`pnpm test:full`) on the machine that made it, before it opened. That's every package's tests, one after another: 12.8 minutes, half of it the 288 web end-to-end tests (#309). Two worktrees doing so at once pegged the CPU, and each suite took twice as long and failed on load alone, so it ran again. This retires that pattern: **`pnpm test:full` before every PR**.

CI runs the full suite instead, on every push to a PR: its packages side by side, the end-to-end tests split across jobs, as many jobs as it's given. Locally, a change runs `pnpm test:change`, which is what CI can't catch as cheaply:

- the server, ui, models and browser-monitoring tests, and the web app's browser tests in `src/`, which take about a minute and a half;
- the end-to-end specs the change adds or edits, the web app's and the landing site's, three times each (`--repeat-each=3 --fail-on-flaky-tests`), in every project their tags name. A test that passes alone and fails beside others shows here, not on CI (#310);
- the web app's specs for the screens the change touches, named on the command line, once.

The web and landing smoke tests are left to CI. Local end-to-end runs default to 2 workers (`packages/web/e2e/slots.ts`): alone that's as fast as 6 for the specs a change touches, 70 s against 73 s, and two runs at once (two checkouts) take 105 s each and pass, where at 6 they took 133 s each and one failed (#309).

A PR opens as a draft once its review is clean and `pnpm test:change` passes. CI is its full suite: what fails there is rerun locally, fixed and pushed, and the PR is marked ready once every check is green.

We chose this over a lock, so that one checkout's tests wait for another's: the second run would take ~140 s rather than 105 s, and nothing failed at 2 workers without it. We also chose it over a faster full suite run locally. The suites are being made faster too (#312-#316), but one machine runs them one after another, and CI scales with jobs.

## Consequences

- What a change runs before its PR is `pnpm test:change` and the Checks; `pnpm test:full` is still there for running by hand, and `pnpm test` keeps the smoke tests for the same.
- A new or edited end-to-end test runs locally three times before CI sees it, so its spec can't reach CI unrun.
- An edit to the end-to-end harness (`e2e/harness.ts`, `playwright.config.ts`) runs locally only in the specs named and edited. The rest of the suite meets it first on CI, on the draft.
- A PR is green on CI before it's marked ready for review; a draft's red run is the author's to fix.
