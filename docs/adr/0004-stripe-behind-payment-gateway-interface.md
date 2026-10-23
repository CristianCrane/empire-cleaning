# Stripe as the payment provider, behind our own Payment Gateway interface

Stripe takes every Deposit, Balance, refund and fee (ADR-0001). The rest of the system never talks to Stripe directly: it goes through our provider-neutral Payment Gateway interface (save Payment Method, charge, refund), and Stripe is one adapter behind it; tests use a fake. Clients enter cards in Stripe's own browser form, so card numbers never reach our server, which keeps us out of most PCI compliance scope.

## Consequences

- Swapping the code to another provider means writing a new adapter. To keep that true, no Stripe types, ID formats or concepts may leak past the interface.
- What the interface cannot make portable: saved Payment Methods live at Stripe (we only hold references), so moving providers means a Stripe-assisted card data export or Clients re-entering cards; the web app's card form is Stripe's and would be replaced; payouts, disputes and reporting run in Stripe's dashboard.
- Production refuses to start without Stripe keys, as with the Resend key.
