# Lint rules

The repo's own lint rules, as oxlint JS plugins (`.oxlintrc.json`'s `jsPlugins`, run by `pnpm lint`). JS plugins are in alpha in oxlint and not bound by semver, so each rule is tested through oxlint's own `RuleTester` (`pnpm --filter @empire-cleaning/lint test`, in CI's Checks job), and an oxlint update that changes the plugin API fails there.

## `empire/report-unexpected`

Every error a screen catches but didn't expect goes to Sentry (#351). A `catch` clause, a `.catch(handler)` and the second handler of a `.then(ok, handler)` each rethrow, or call the package's reporter (the rule's `reporters` option, set per package in `.oxlintrc.json`):

- the web app: `reportUnexpected` (`packages/web/src/monitoring.ts`), which skips the API's answers and a card that couldn't be used
- the Quote form and the landing site: the browser's `reportError`, which skips nothing itself; the host's Sentry picks it up once it has started (ADR-0007)
- the design system: none, so a catch there rethrows or says why it expects its throw
- everywhere: Sentry drops a dropped connection

A handler passed by name (`.catch(reportUnexpected)`) passes when it's the reporter. A call anywhere in the handler counts, but not one in a function the handler makes, which may never run. A catch that only ever expects its throw says why, as blocked storage does in `packages/ui/src/stored.ts`:

```ts
// oxlint-disable-next-line empire/report-unexpected -- blocked storage, expected
```

The rule is on in `packages/{web,quote-request,landing,ui}/src`, but not in tests or stories. The server reports through its own Sentry.
