# A refund that fails after it's made counts for nothing, and the Office gives it back another way

Stripe reports some refunds as succeeded, then fails them, as when the card has since been closed: `pm_card_refundFail` is refunded at once, and about two minutes later the refund turns failed and `refund.failed` is sent. The app recorded a refund once it was made and never heard otherwise, so the ledger showed money given back that wasn't (#241).

Now a refund the provider fails is marked failed, and counts for nothing from then on. One made in the provider's dashboard was a discount (ADR-0021), so the discount is undone. One of ours leaves the money owed back again: on the Job's ledger, or as a Bill's credit not yet refunded. The urgent `refund_failed` signal tells the Office, who give it back another way. Settling never refunds from that Charge again, as the same card would only fail again.

We chose this over trying again on the next settling, which would most likely fail the same way, and over deleting the refund, which would lose the record that it was tried.

## Consequences

- The Client's Payments page no longer shows a refund that failed.
- Told twice of the same failure, the app counts it once. A refund it never recorded is still signalled, to look into.
- The provider may say a refund went through (`refund.updated`, or `charge.refunded`) before failing it. A dashboard refund is recorded as given, then marked failed. Asked again later, the provider leaves out a failed refund, so it isn't recorded a second time.
- A refund still on its way (pending) is recorded as given, as before, and is marked failed if it fails.
