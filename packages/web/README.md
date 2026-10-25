# Web app

The one React app for the Office, Clients and Cleaners (ADR-0003), built with Vite. It talks to the server only through its JSON API. `pnpm dev` at the repo root starts it on http://localhost:5173.

Every screen is built from the design system in `packages/ui` (`@empire-cleaning/ui`). Its README covers the components, the Storybook catalogue and the browser setup the tests need.

## Areas and sign-in

| URL                         | For                                                                              |
| --------------------------- | -------------------------------------------------------------------------------- |
| `/sign-in`                  | anyone: emailed link or Google                                                   |
| `/office`                   | Office Staff                                                                     |
| `/cleaner`                  | Cleaners                                                                         |
| `/portal`                   | Clients: their Quote Requests and homes                                          |
| `/portal/request`           | Clients: request a Quote for a new home or one of theirs                         |
| `/portal/details`           | Clients: contact details and Access Instructions                                 |
| `/office/requests`          | Office Staff: open Quote Requests                                                |
| `/office/clients/$clientId` | Office Staff: a Client, their homes and Quote Requests, and Condition correction |
| `/welcome`                  | an Account connected to nothing: request a Quote to become a Client              |
| `/`                         | sends a signed-in Account to its area                                            |

- Someone signed out who opens an area goes to `/sign-in?next=…` and comes back to that page afterwards.
- An Account opening another role's area is sent to its own area.
- Staff with both roles start in the Office and switch areas from the account menu.
- When a sign-in link has expired or been used, or a Google account has no Empire Cleaning Account, the person lands back on `/sign-in` with `?error=` and a plain explanation.

`src/session.ts` holds the Better Auth browser client (functions only, no UI), the areas and the signed-in Account, asked of `GET /api/me` once and remembered until sign-out. The route guards live in `src/router.tsx`.

The signed-in Account is remembered, not asked for on every click. The app asks `GET /api/me` again when the person switches to another area, comes back to the tab (`src/main.tsx`), or does something that can connect their Account to a record. That is when it can have changed behind the app's back: a Quote Request from the landing page, the Office adding a record, signing out in another tab.

In dev, Vite forwards `/api` to the server (`API_URL`, by default http://localhost:3000), so the app and the API share an origin and sign-in cookies just work. Production should do the same: serve the app and route `/api` to the server on one domain.

## Knowing where you are

Pages more than one step from their area's navigation start with `Breadcrumbs`, e.g. Requests › Casey Client. The navigation marks the section a page belongs to as current (`alsoCurrentFor` in `src/screens/AreaLayout.tsx`), so a Client reached from Requests keeps Requests highlighted.

## Links

Routing is TanStack Router, and design-system links (`Link`, AppLayout's nav) navigate through it. Every route is a named constant in `src/router.tsx`: written inline inside `addChildren()`, a route loses its types and so does every link. Screens read their data with `useLoaderData` from their route's `loader`, through `getJson` in `src/api.ts`. Every link is made with `linkTo()` from `src/links.ts`, which gives it the same checking as TanStack's own links: the route must exist, and its params must be given.

```tsx
<Link href={linkTo({ to: "/portal" })}>Home</Link>
```

A plain string or a hand-written `{ to }` object doesn't compile.

## Testing

End to end with Playwright (`e2e/`): a production build of the app runs in a real Chromium, on a phone and a desktop, against the real API and a database of its own (`empire_e2e_test`). Only email, payments and the clock are faked, with the same fakes the server tests use (`packages/server/tests/e2e/server.ts`). Tests sign in by following the link from the captured email, exactly as a person would.

```sh
pnpm --filter @empire-cleaning/web test       # needs Postgres (pnpm db:up) and Chromium
pnpm --filter @empire-cleaning/web test:e2e   # just the end-to-end tests
```

Small screen-only behaviour can still use Vitest browser tests (`src/**/*.test.tsx`), as the design system does.
