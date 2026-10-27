# Commercial Clients can be billed weekly

ADR-0001 charges each Job on completion. A commercial Client on a Service Plan of 5 or 6 days a week (ADR-0013) would get about 26 Charges and receipts a month, each with its own card fee, and businesses expect one bill they can file. So Office Staff can switch a commercial Client to weekly billing: everything they owe for a week, Monday to Sunday in New York, goes on one Bill made the following Monday. Residential Clients keep being charged per Job.

By default the Bill is charged to the Client's saved Payment Method when it's made and emailed as a receipt; Office Staff can instead have a Client pay each Bill on its page within 14 days (or other terms they set), by card or ACH Direct Debit. We chose this over invoicing after the Job as the default, which leaves Empire Cleaning carrying the collection risk that ADR-0001 avoids, and over Stripe Invoicing, whose per-invoice fee we'd pay on every Bill: Bills, their page, emails and reminders are our own, and payments go through the Payment Gateway (ADR-0004) as now.

The Deposit stays as ADR-0001 has it: taken by card when a Quote is accepted, so every Client billed weekly has a saved Payment Method, and a plan's Deposit is applied when it Ends.

## Consequences

- A Bill covers the Client's Jobs, at all their Properties, that started that week and were Completed, or ended as a Late Cancellation or No Access with a fee, with the Adjustments approved by the time it's made and any one-off Jobs less their Deposits. Fees and Adjustments are lines on it, not Charges of their own. Whatever is settled later goes on the next week's Bill.
- A Bill never changes once made, like a Sent Quote. A mistake is put right on the next Bill; Office Staff can void an unpaid Bill that shouldn't have gone out, and its Jobs go on the next one.
- A Bill below zero becomes a credit on the next one; whatever remains is refunded if no Bill follows within 30 days.
- A Bill paid automatically is Unpaid if its Charge fails; one paid on its page is Unpaid from the day after it's due. Either way the Client's Service Plans with Jobs on it are On Hold, and it's under Needs attention, until it's paid. Reminders go out when it's sent, 3 days before it's due, on the day, and weekly while it's late. Office Staff can record a payment made another way, such as a cheque, which settles it.
- Bills and receipts go to an optional billing email on the Client, falling back to their own, and carry the whole Bill. Its page opens only for the Client, signed in (ADR-0006).
- Switching weekly billing on applies from the current week; switching it off leaves Bills already made due, and everything else goes back to being charged per Job.
- Pushed bank transfers, PDFs and residential Clients are left out until asked for.
