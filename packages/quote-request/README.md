# Request a Quote form

The one Request a Quote form, used by the landing site, the Client portal and the Office. It posts to `POST /api/quotes/ask`, and the API is its only validator.

```tsx
<QuoteRequestForm
  asker={{ kind: "guest" }} // or { kind: "account" }, { kind: "client", properties, open?, businessName? }, { kind: "office", client }
  apiUrl="https://…" // "" (the default) when served beside the API
  headingLevel={2} // one below the heading it sits under (default 3)
  onSubmitted={(receipt) => …}
/>
```

The rest of its props, each with its comment: `src/QuoteRequestForm.tsx`. Its language is the `LanguageProvider`'s around it (the page's, or a Client's Preferred Language; English for the Office), and its words are in `src/words.ts`.

It has no tests of its own: it's tested end to end where it's used, `packages/landing/tests` and `packages/web/e2e`.
