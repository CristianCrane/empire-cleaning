# Request a Quote form

The one Request a Quote form (#3), used by the landing site for Guests and by the web app's portal and welcome page for signed-in people. It's built from the design system and posts to `POST /api/quotes/ask`.

```tsx
<QuoteRequestForm
  asker={{ kind: "guest" }} // or { kind: "account", email } / { kind: "client", properties }
  apiUrl="https://…" // "" (the default) when served alongside the API
  headingLevel={2} // one below the heading the form sits under (default 3)
  onSubmitted={(receipt) => …} // receipt.emailedTo is where the Quote will go
/>
```

It asks in steps, so only a few questions show at once (#96): what and where (one question for a house, apartment, townhouse or business premises, then the address), then about the place, then who is asking, when the form needs that (a Guest, a signed-up Account or a new caller; a Client's details are known). Next checks the step's required fields. A message from the API takes the form back to the step with that field. Optional extras (floor area, how we get in, a note) wait behind "+ Add …" links until they're wanted. Short choices are segmented controls and chips rather than a box per option.

It starts by asking whether it's about a home or business premises (#72). A home is described by its rooms and Condition, with any Add-ons for homes and a wish for regular visits; business premises by the business's name, a Premises Type (loaded from `GET /api/price-list/premises-types`), an optional floor area, and either the weekdays and preferred start time to clean or a one-off. Their Condition and extras are agreed after a Site Visit, so they aren't asked.

A signed-in Client's form lists their homes, with `waiting` (the ids of homes whose request is still waiting) shown but not selectable; asking again about a waiting home is refused by the API with a message the form shows.

The form lists the Add-ons on offer by name ("Any extras?"), loaded from `GET /api/price-list/add-ons`, with no prices: those are on the Quote. If they can't be loaded the section is simply absent.

The API is the only validator. The form shows the API's field messages beside the matching fields, plus the browser's own checks for required fields. A Guest's request is sent without cookies, so someone signed in to the app is still treated as a Guest on the landing page. The form is tested end to end where it's used: `packages/landing/tests` and `packages/web/e2e`.
