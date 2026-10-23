# dev mode

1. start the db (docker):

```shell
pnpm run db:up
```

2. concurrently start all the apps in dev mode (watch + hot reloading):

```shell
pnpm run dev
```

3. browse the design system catalogue (Storybook, http://localhost:6006):

```shell
pnpm --filter @empire-cleaning/web storybook
```

4. run every package's tests (the web tests need a browser; see packages/web/README.md):

```shell
pnpm test
```

5. clean up when finished:

```shell
pnpm run db:down
```
