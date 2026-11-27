# The seed test keeps all 28 instants

The seed test runs the seed at 28 instants, four times of day on each day of a week (`tests/seed.test.ts` says why). Offered skipping it locally or running one instant, the user said on 2026-11-05: "We'll go ahead and leave it as it is. Having the seed remain consistent is important."

This rules out **cutting its instants** to save time. CI runs all 28 on every PR, shared out by `SEED_SHARD`; `pnpm test:change` leaving the seed test to CI (#311) cuts none.
