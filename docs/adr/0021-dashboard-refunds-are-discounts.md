# A refund made in the payment provider's dashboard is a discount: the Client owes that much less

The app has no way for the Office to give money back by hand, so they do it in Stripe's dashboard, usually as goodwill: a clean that wasn't quite right, a gesture to a regular. The server records each one against the Charge it came from, as told by the provider's webhook (`charge_refunded`, then the Charge's refunds not made by us), and counts it as a discount: what the Job owes drops by that much, though never below nothing. So settling the Job again, after a completion is corrected or an increase approved, never charges it back, and a later refund (a free cancellation) gives back only what's left of the Charge. A Bill's parts count it as taken, so no Bill bills it back either.

We chose this over treating it as a payment undone, which every ledger would then show as owed and the next settling would charge again, taking back what the Office meant to give. And over adding a Refund action in the app for the Office: worth doing, but it's more to build and doesn't stop a refund being made in the dashboard anyway, which still has to mean something.

## Consequences

- Our own refunds carry a mark at the provider (`made_by: app`), so one is never mistaken for a dashboard refund, even when the webhook arrives before we've recorded it. Each refund is recorded once (unique by its provider id).
- A refund that's still on its way (pending) is recorded as given; if it later fails at the provider, the app doesn't hear of it.
- A dashboard refund of a payment we have no Charge for is only the counted `refunded_at_provider` signal (ADR-0007).
- The Client's Payments page and the Job's history show it as a refund, as any other.
- If the Office one day needs to undo a payment rather than give a discount, that's a new case to add, not this one.
