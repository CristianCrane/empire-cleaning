# Quote Request form

The one Quote Request form (#3), used by the landing site for Guests and by the web app's portal and welcome page for signed-in people. It's built from the design system and posts to `POST /api/quote-requests`.

```tsx
<QuoteRequestForm
  asker={{ kind: "guest" }} // or { kind: "account", email } / { kind: "client", properties }
  apiUrl="https://…" // "" (the default) when served alongside the API
  headingLevel={2} // one below the heading the form sits under (default 3)
  onSubmitted={(receipt) => …} // receipt.emailedTo is where the Quote will go
/>
```

A signed-in Client's form lists their homes, with `waiting` (the ids of homes whose request is still waiting) shown but not selectable; asking again about a waiting home is refused by the API with a message the form shows.

The form lists the Add-ons on offer by name ("Any extras?"), loaded from `GET /api/price-list/add-ons`, with no prices: those are on the Quote. If they can't be loaded the section is simply absent.

The API is the only validator. The form shows the API's field messages beside the matching fields, plus the browser's own checks for required fields. A Guest's request is sent without cookies, so someone signed in to the app is still treated as a Guest on the landing page. The form is tested end to end where it's used: `packages/landing/tests` and `packages/web/e2e`.
