# One React SPA over a JSON API, no server-rendered web layer

The Office workspace, Client portal and Cleaner area are one React single-page app built with Vite, in its own monorepo package, and it talks to the server only through the JSON API — that API is the sole way into the system. We chose this over Next.js or other server-rendered frameworks, which would add a second server layer where logic could hide from the API, and over three separate apps, which would triple the codebase for a small team. The main driver is a likely future native Cleaner app (e.g. GPS-based time on site): with an API-only server, that app is a peer of the web app rather than a rewrite.

## Consequences

- No business logic, authorization or data shaping may live only in the web app; anything the web app can do, another client can do through the API.
- Sign-in must work for non-browser clients too (see ADR-0002).
- The public landing page for prospective Clients is not part of this SPA: it's a separate static site (ADR-0005).
