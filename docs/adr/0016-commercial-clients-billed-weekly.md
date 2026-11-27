# Commercial Clients can be billed weekly

A commercial Client on a Service Plan of 5 or 6 days a week (ADR-0013) would get about 26 Charges and receipts a month, each with its own card fee, and businesses expect one bill they can file. So Office Staff can switch a commercial Client to weekly billing: everything they owe for a week, Monday to Sunday in New York, goes on one Bill made the following Monday. For them this replaces ADR-0001's and ADR-0010's Charge on completion, and settles the batching ADR-0013 left as a separate decision.

By default the Bill is charged to the Client's saved Payment Method when it's made and emailed as a receipt; Office Staff can instead have a Client pay each Bill on its page within 14 days (or other terms they set), by card, or ACH from a bank account linked by signing in to the bank, never by microdeposits, whose code takes a day or two and runs a weekly Bill past its due date. We chose this over invoicing after the Job as the default, which leaves us the collection risk ADR-0001 avoids, and over Stripe Invoicing, whose per-invoice fee we'd pay on every Bill: Bills are our own, paid through the Payment Gateway (ADR-0004).

The Deposit stays as ADR-0001 has it, so every Client billed weekly has a saved Payment Method.

## Consequences

- A Bill covers the Client's Jobs, at all their Properties, that started that week and were Completed, or ended as a Late Cancellation or No Access with a fee, with the Adjustments approved by the time it's made and any one-off Jobs less their Deposits. Fees and Adjustments are lines on it, not Charges. Whatever settles later goes on the next Bill, as does a Job whose own payment is still going through, billed then only if it failed.
- A Bill never changes once made. A mistake is put right on the next Bill; Office Staff can void an unpaid Bill that shouldn't have gone out, and its Jobs go on the next one.
- A Bill below zero becomes a credit on the next one; whatever remains is refunded if no Bill follows within 30 days, from what the Client's Bills took, never from a Job's own Charges.
- A Bill paid automatically is Unpaid if its Charge fails; one paid on its page is Unpaid from the day after it's due. Either way, until it's paid, the Client's plans with Jobs on it are On Hold and it's under Needs attention. Reminders go out when it's sent, 3 days before it's due, on the day, and weekly while it's late. Office Staff can record a payment made another way, such as a cheque.
- A payment on a Bill is a Charge attempt, held by ADR-0022's one rule. One made on its page saves no card or bank account, and one that fails before the due date pauses no plan.
- Bills and receipts go to an optional billing email on the Client, falling back to their own. Client portal > Bill opens only for the Client, signed in.
- Switching weekly billing on applies from the current week; switching it off leaves Bills already made due, and the rest goes back to per Job. Money a paid Bill took for a Job that no longer owes it is refunded from the Bill's Charge, never the Job's Deposit.
- A Job's price on a Bill comes down to nothing at most, as it does when charged per Job.
- Pushed bank transfers, PDFs and residential Clients are left out until asked for.
