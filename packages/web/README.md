# Web app

The one React app for the Office, Clients and Cleaners (ADR-0003), built with Vite. It talks to the server only through its JSON API. `pnpm dev` at the repo root starts it on http://localhost:5173.

Every screen is built from the design system in `packages/ui` (`@empire-cleaning/ui`). Its README covers the components, the Storybook catalogue and the browser setup the tests need.

Feature screens are tested in a real Chromium (Vitest browser mode), like the design system: `pnpm --filter @empire-cleaning/web test`.
