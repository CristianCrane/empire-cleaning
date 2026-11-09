# Tests: rules, measuring, and findings

How Empire Cleaning's tests are meant to be written, how a question about them gets settled, and what each round of work on them found. Read this before writing a test, changing how tests start, stop or wait, or chasing one that fails or runs slow.

- **The rules** are what every test, and every change to how they run, keeps, each with the bug that taught it.
- **Settling a test question** says how a cause gets shown and how to time things on this machine.
- **The findings log** at the foot gives each finding's date, one line, and where its evidence lives. Check it before chasing a failure: the same one has turned up twice already.

How each package's tests work, and how to run them, is in its README (`packages/server`, `packages/web`, `packages/landing`, `packages/ui`). What runs before a PR is in the root `README.md` and ADR-0026.

## Rules

### End-to-end tests (Playwright)

**Check accessibility with `expectAccessible(page)` from the package's harness, never axe directly**. That's `packages/web/e2e/harness.ts` or `packages/landing/tests/harness.ts`; lint stops a spec importing `@axe-core/playwright`. Both wait until nothing on the page is animating before they run axe, and web's also until what it checks, and everything around it, is fully opaque: an animation can be yet to start. Text checked mid-fade fails on contrast now and then, so the test passes locally and fails in CI at random: main went red this way after #228. In web, pass a selector to check only part of the page, such as an open dialog: `expectAccessible(page, "[role=dialog]")`. A failure lists each element with what's wrong, e.g. the two colours and their contrast. Web's also fails when the page shows a frame of another origin, such as Stripe's real card form, which axe can't check there. The design system's story tests run axe their own way (`packages/ui/README.md`).

**A spec that walks through something the app holds as data reads it from that data, never types it again**: a tour's steps from its tours file (`walkTour` in `packages/web/e2e/tours.spec.ts`). Playwright's `getByRole` matches `name` ignoring case and as a substring unless `exact`, so a copy that has drifted still passes: two tour titles did after #336 (the log, 2026-11-09).

**Switch area with `switchArea(page, area)` from `packages/web/e2e/harness.ts`, never by pressing "Switch to …" and waiting on the URL.** Open the person's Account menu first; `switchArea` presses the row and waits until the new area is on screen. The URL changes at once, but until the new area is ready the old one stays on screen, its menu open, so a test that goes on at the URL can press something in the old area, which the new one then throws away. It passed alone and timed out in every full local run (#310).

### Time budgets

**A project sets the budget for its kind of test, and says why in its config; a single test past it says so beside it, with why, and the issue that will bring it back when there is one.** The server tests keep Vitest's 5 s (`changing.test.ts:113` has its own 10 s, as it does a plan change's whole work), the seed test 120 s and the design system's story tests 30 s (each in its `vitest.config.ts`). The end-to-end tests keep Playwright's 30 s, and `test.slow()` triples it for one test (`layout.spec.ts`, each with its reason). Raising a project's budget to fit one slow test would hide a hang or a slowdown in all the others.

### Starting and stopping

**A change to how tests start, stop or wait checks how they fail beside how they pass, before its review**: a port already held, a process that dies, a setup step that fails, each failing at once and saying what. A start that's only seen passing can run the tests against the wrong server, or wait out its timeout. On #312 both happened: an API on a held port said it was listening and served nothing, and a failed start left a preview holding the run for 120 s (PR #325, review F3 and F10).

## Settling a test question

**Show the cause before fixing it,** with the evidence the `change` skill names (`.claude/skills/change/SKILL.md`, Survey). For tests, that comes down to:

- **Time on a quiet machine, and give the load beside the timing.** Check for another checkout's run (`pgrep -af "playwright|vitest"`). Check Windows' CPU too, from PowerShell: `Get-Counter '\Processor(_Total)\% Processor Time'`, and `'\Process(*)\% Processor Time'` for who. WSL can look idle while Windows starves it (the log, 2026-11-03 and 2026-11-07).
- **A run alone against one beside another.** A test red only beside another checkout's run is load or something shared, such as a port or a database name. Many copies of one test at once (`--repeat-each`, several workers) tell a race apart from state left behind (#310).
- **How close a test runs to its budget**, from its duration in a run: `vitest run --reporter=json --outputFile=…`, or Playwright's report. The tests near it are the ones that fail under load.
- **Reproduce a failure as the tool runs it**: with its `PATH` (pnpm puts `node_modules/.bin` on it, and Playwright's webServer passes it on), its working directory and its shell. Run by hand without them, a missing `vite` read as `wait -n` failing (#312, comment).
- **The shared test Postgres** has its own signs of strain: `packages/server/README.md`, Testing.
- **The machine's own faults** (WSL, NixOS, the shell): CristianCrane/.dotfiles#5, and the spinning `wsl.exe` threads' fix, CristianCrane/.dotfiles#8 (the log, 2026-11-07).

Record what you find in the log below.

## Findings log

Newest first. The evidence lives where the link points; the row only says what was found.

| Date | Finding | Where |
| --- | --- | --- |
| 2026-11-09 | Two tour titles in the tours spec went stale when #336 changed their case ("Your Quote", "The Schedule") and still passed: Playwright's `getByRole` matches `name` ignoring case, as a substring, unless `exact`. The spec now walks each tour from its data (`walkTour`), so a step's title and target are written once, in the tour | #296 plan review F2, `packages/web/e2e/tours.spec.ts` |
| 2026-11-07 | The spinning `wsl.exe` threads earlier today had one cause, and 2026-11-03's, with the same signs, likely the same: a WSL bug (microsoft/WSL#41173), where an interop launch now and then leaves a Windows-side `wsl.exe` or `wslhost.exe` thread spinning for good. Claude Code fires it, running `reg.exe` twice through interop at every start and every 30 minutes; all 7 spinning threads were created on a Claude process's 30-minute grid. Closing a tab only cleared that tab's threads. An empty file over `reg.exe` on the Linux side stops the launches. Starved, the server tests took 73–81 s; healthy, 50 s. After it, over an hour and two of those ticks: no interop launch, and no spinning thread | CristianCrane/.dotfiles#8 ([checked after](https://github.com/CristianCrane/.dotfiles/pull/8#issuecomment-6713356433)), anthropics/claude-code#108203, [#309 (comment)](https://github.com/CristianCrane/empire-cleaning/issues/309#issuecomment-6712959029) |
| 2026-11-07 | CI's wall time is its slowest job: a web e2e shard held 154 s of tests. With web e2e in 6 shards, the server tests and the seed test in 2 each, a PR's run takes 170 s against ~4 min. `main` requires one check, All checks, which passes only when every job did, so shards can change without touching settings | #315, PR #334, `.github/workflows/ci.yml` |
| 2026-11-07 | The server tests wait on Postgres ~30% of the time, not half: 64 s of 212 s at 1 worker, 117 s of 386 s at 6, over 275,155 queries. The rest is their own JavaScript, which nearly doubles at 6 workers as they share the CPU. In a profile of the three biggest files, drizzle building queries was 37% of the CPU, and the one-connection guard formatting a stack for every query in a transaction 7%; the guard now formats one only on an overlap, and `askedAddOns` read the Price List its caller already had, 13,571 queries. The run at 6 workers takes 73–77 s against 81 s. `changing.test.ts:113` went from ~3.8 s to ~3.6 s, so it keeps its 10 s. With 6 busy loops beside it, main failed 10 tests on the 5 s budget and this 2 | #316, `packages/server/tests/setup/oneConnection.ts` |
| 2026-11-07 | Web's axe checks took 164 s of a 495 s e2e run at 2 workers: 178 checks, median 0.89 s, in `AxeBuilder`'s default mode. In legacy mode with violations only, 0.54 s, and the run takes 464 s against 496 s. Legacy mode skips frames of another origin, and 60 of the 178 checks met Stripe.js's metrics frame, which it adds to every screen, hidden. So the check now fails on any frame of another origin that's shown | #329, `packages/web/e2e/harness.ts` |
| 2026-11-07 | The landing tests ran one at a time because every test reset the API's one database, though only the Quote form tests write to it. A Guest's Client is found by email, so each of those tests now asks with an address of its own, nothing resets, and the suite runs at 2 workers: 70 s against 122 s. axe was then half the time left: `AxeBuilder`'s default runs it in each frame and again in a blank page, ~1 s a check, against 0.33 s in legacy mode with violations only. The suite at 2 workers takes ~57 s | #313, `packages/landing/tests/harness.ts` |
| 2026-11-07 | Express 5's `app.listen` hands a listen error to its callback, and ours only logged, so an API on a port in use said it was listening, served nothing and stayed up. One `listen` in `src/server.ts` now fails on it, so a failed start exits, reported by the `uncaughtException` handler | #312, `packages/server/src/server.ts` |
| 2026-11-07 | e2e slots start at once: Playwright started its `webServer` entries one after another, 4.9 s a slot, each migrating its own database, and the app build after them. One entry now builds the app while one launcher starts every slot's API, as one template is migrated and copied. The first test starts at 7.0 s with 6 slots, against 32.2 s, and at 5.6 s with 1, against 7.9 s; landing's at 6.0 s, against 10.3 s | #312, `packages/server/tests/e2e/servers.ts` |
| 2026-11-07 | `changing.test.ts:113` is the slowest server test, 2.9 s alone where the next takes 2.2 s and the median 239 ms. With two checkouts' checks at once it passed 5 s, so it gets 10 s until fewer queries per request bring it down | PR #323, the test's comment, #316 |
| 2026-11-07 | Web's browser tests held to Vitest's one port, 63315, through the dev server's `strictPort`, so a second checkout's run failed. They now move to a free one, as ui's do | PR #323, `packages/web/vitest.config.ts` |
| 2026-11-07 | Before a PR, `pnpm test:change` for a typical change takes 157 s alone and 225 s with another checkout's at once, against a 12.8 min full suite | ADR-0026, PR #323 |
| 2026-11-07 | Docker's localhost port forward doubles every query's round trip, 0.38 ms against 0.18 ms to the container's address. Pointing the server tests at the container cut a starved run from 195 s to 120 s | [#309 (comment)](https://github.com/CristianCrane/empire-cleaning/issues/309#issuecomment-6702793503) |
| 2026-11-07 | A spinning `wsl.exe` behind WezTerm tabs again: 10.8 of 12 threads, with the Linux VM getting 0.23 cores. 7 to 12 server tests timed out on code CI passed; closing the tabs took the server tests from 195 s to 62 s, all green | [#309 (comment)](https://github.com/CristianCrane/empire-cleaning/issues/309#issuecomment-6702793503) |
| 2026-11-07 | e2e tests switching area on the URL alone lost a race to `/api/me`: green alone and at 1, 2 or 6 workers, red in 6 of 6 copies at once. A trace showed the click landing on the old area 50 ms before `/api/me` answered | #310, PR #319 |
| 2026-11-06 | Baseline for round 3: the full suite 12.8 min, one package after another. Two checkouts' touched specs at once at 6 workers took 133 s each, with a failure each; at 2 workers, 105 s each and green | #309 |
| 2026-11-05 | The shared test Postgres: a full suite peaks at 67 connections, and web e2e took 3.6 min alone and 4.7 beside another checkout's server tests | `packages/server/README.md`, Testing |
| 2026-11-04 | `expectAccessible` still caught a dialog mid-fade now and then, as an animation can be yet to start: 6 of 24 repeats of one Staff test failed on contrast. Web's check now also waits until what it checks is opaque | PR #253 |
| 2026-11-03 | A Windows `wsl.exe`, the bridge for one WezTerm tab, spun at 10.6 cores while Linux used 0.17. Closing the tab fixed it; the tests left nothing running | PR #240 |
| 2026-11-03 | Round 2: a run starts only the slots its workers use, and drops leftover test databases. One spec at 1 worker went from 52.1 s to 30.4 s | PR #240 |
| 2026-11-02 | An axe check taken while a dialog slid in failed on contrast, and main went red after #228. One `expectAccessible` for every spec waits until nothing animates | PR #233 |
| 2026-10-28 | Round 1: the time was spread across every test, so parallelism was the lever. Server tests went from 83 s to 32 s, a database per worker; web e2e from 8.1 to 3.0 min, a slot per worker; 6 workers, as 8 was no faster | #115, PR #118 |
| 2026-10-25 | The test Postgres in memory: a commit took 47 ms on a Docker volume. `TRUNCATE` took ~4 s a test, so one `DELETE` transaction empties the tables. Loading the server takes ~5 s, so a worker's files share one (`isolate: false`). The design system's tests at 3 workers took 45 s against 66 s | `packages/server/README.md`, Testing; `packages/ui/vitest.config.ts` |
