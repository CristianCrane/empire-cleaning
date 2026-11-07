#!/usr/bin/env bash
#
# The local check before a PR: what this machine runs, while CI runs the full
# suite (docs/adr/0026-the-full-suite-runs-on-ci.md).
#
#   pnpm test:change [spec…]   e.g. pnpm test:change e2e/bills.spec.ts
#
# naming each spec as packages/web takes it, for the screens the change
# touches. It runs:
#
# - the server (not the seed test), ui, models and browser-monitoring tests,
#   and web's few browser tests in src/
# - every e2e spec the branch adds or edits, committed or not, three times
#   (--repeat-each=3 --fail-on-flaky-tests), so a test that passes alone and
#   fails beside others shows here rather than on CI (#310)
# - the specs named, once
#
# With no --project, each spec runs in every project its tags name: phone,
# and desktop for @desktop (packages/web/playwright.config.ts). The edited
# specs come from git rather than Playwright's --only-changed, which also
# takes every spec importing a changed file: an edit to e2e/harness.ts would
# run nearly all of them, three times.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

base=$(git merge-base HEAD origin/main)
mapfile -t edited < <(
  {
    git diff --name-only --diff-filter=d "$base" -- 'packages/web/e2e/*.spec.ts'
    git ls-files --others --exclude-standard -- 'packages/web/e2e/*.spec.ts'
  } | sed 's|^packages/web/||' | sort -u
)
named=()
for spec in "$@"; do
  [[ " ${edited[*]} " == *" $spec "* ]] || named+=("$spec")
done

failed=0
run() {
  echo "› $*"
  "$@" || failed=1
}

run pnpm --color --recursive --workspace-concurrency=1 --no-bail \
  --filter @empire-cleaning/server --filter @empire-cleaning/ui \
  --filter @empire-cleaning/models --filter @empire-cleaning/browser-monitoring \
  run test:quick
run pnpm --filter @empire-cleaning/web exec vitest run
if ((${#edited[@]})); then
  run pnpm --filter @empire-cleaning/web exec playwright test \
    --repeat-each=3 --fail-on-flaky-tests "${edited[@]}"
fi
if ((${#named[@]})); then
  run pnpm --filter @empire-cleaning/web exec playwright test "${named[@]}"
fi
if ((${#edited[@]} + ${#named[@]} == 0)); then
  echo "No e2e spec ran: name the specs for the screens the change touches."
fi
exit $failed
