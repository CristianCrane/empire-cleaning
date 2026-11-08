# Edited end-to-end specs run once before a PR

ADR-0026 had `pnpm test:change` run every end-to-end spec a branch adds or edits three times (`--repeat-each=3 --fail-on-flaky-tests`), so a test that passes alone and fails beside others would show locally rather than on CI (#310). But "edited" is the whole file: a change that rewords the screens touches the specs that find those words, and each runs three times over. #336's scheduling screens edited 12 specs for wording alone, and the check took 1,064 s, most of it those repeats. This retires that pattern: **edited specs run three times before a PR**.

They run once, with the specs named. We chose this on 2026-11-08, while the app is only in test: "3 times takes too much time right now. We're only in test not production". CI still runs every spec on every push; a flaky test now shows there first, and is fixed there before the PR is marked ready. A spec can still be repeated by hand when a flake is suspected (`docs/testing.md`, Settling a test question).

We chose this over three times only for new spec files, which keeps the check where a new test is likeliest to be flaky, as the time matters more now. Before launch, with real Clients, the repeats are worth weighing again.
