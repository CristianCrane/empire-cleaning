# The full suite runs on CI, not locally

Every PR ran the full suite (`pnpm test:full`) on the machine that made it, before it opened: every package's tests, one after another, 12.8 minutes. Two worktrees doing so at once pegged the CPU, and each failed on load alone, so it ran again (#309). This retires that pattern: **`pnpm test:full` before every PR**.

CI runs the full suite instead, on every push to a PR: its packages side by side, the end-to-end tests split across jobs, as many jobs as it's given. Locally, a change runs `pnpm test:change`, which is what CI can't catch as cheaply:

- the server, ui, models and browser-monitoring tests, and the web app's browser tests in `src/`;
- the end-to-end specs the change adds or edits, the web app's and the landing site's, in every project their tags name (how many times: ADR-0028). A test that passes alone and fails beside others shows here, not on CI (#310);
- the web app's specs for the screens the change touches, named on the command line, once.

The web and landing smoke tests are left to CI. Local end-to-end runs default to 2 workers (`packages/web/e2e/slots.ts`; why, and the times: ADR-0032).

A PR opens as a draft once its review is clean and `pnpm test:change` passes. CI is its full suite: what fails there is rerun locally, fixed and pushed, and the PR is marked ready once every check is green.

We chose this over a lock, so that one checkout's tests wait for another's: slower, and nothing in the end-to-end tests failed at 2 workers without it. We also chose it over a faster full suite run locally: the suites are being made faster too, but one machine runs them one after another, and CI scales with jobs.

## Consequences

- What a change runs before its PR is `pnpm test:change` and the Checks; `pnpm test:full` is still there for running by hand, and `pnpm test` keeps the smoke tests for the same.
- An edit to the end-to-end harness (`e2e/harness.ts`, `playwright.config.ts`) runs locally only in the specs named and edited. The rest of the suite meets it first on CI, on the draft.
- A PR is green on CI before it's marked ready for review; a draft's red run is the author's to fix.
