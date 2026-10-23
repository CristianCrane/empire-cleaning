# A separate static landing site alongside the SPA

The public landing page for prospective Clients is its own static site (Astro, in `packages/landing`), prerendered to plain HTML at build time, rather than a route inside the React SPA (ADR-0003). A client-rendered SPA serves search engines and link previews an almost empty page, and makes a first-time visitor on a phone download the whole app before seeing anything. Static HTML loads instantly and is fully readable by search engines. It replaces the current Next.js site at empirecleaningandpro.com, and takes nothing from its design or code.

## Considered Options

- **A landing route inside the SPA**: the simplest option, but it has the search and load-time problems above.
- **Prerendering the SPA's landing route**: keeps one app, but couples marketing pages to the app's build and routing.
- **Next.js or another server-rendered framework**: rejected for the same reason as in ADR-0003. Static output needs no server of its own.

## Consequences

- The landing site is another client of the JSON API, exactly like the SPA: no business logic, authorisation or data shaping lives in it. It has no server; it's static files on any static host.
- It uses the same design system tokens and components as the SPA, so the two look like one product. Interactive parts, chiefly the Guest Quote Request form, are React islands built from those components. All other content ships as HTML with no JavaScript.
- A Guest submits their first Quote Request on the landing page without signing in (least Client friction). Signed-in Clients submit further Quote Requests from the Client portal, using the same form.
- The API must accept requests from the landing site's origin as well as the SPA's.
