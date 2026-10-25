# One free Late Reschedule per Job; a later one keeps the Deposit as the fee

A Client who moves a Job is still asking for the clean, so a late move is treated more gently than a cancellation. A Reschedule Request made 24 hours or more before the Job is always free. One made less than 24 hours before (a Late Reschedule, judged when the request is made, by the Clock) is free the first time for that Job: the Deposit stays applied to the Job at its new time. A second or later Late Reschedule of the same Job is a Late Cancellation: the Deposit is kept as the fee and no longer counts towards the price, the Job still moves, and the full price is charged as the Balance on completion. No new Deposit is taken.

We chose this over treating every Late Reschedule as a Late Cancellation (the glossary's first wording), whether by keeping the Deposit as a fee or by charging a fresh Deposit for the moved Job. Both penalise a Client who has had something genuinely come up but still wants the service. The free one is per Job rather than per Client, so it stays simple to explain and Service Plan Clients aren't worn down over time.

## Consequences

- Only a confirmed move uses up the free Late Reschedule or incurs the fee. A late request the Office turns down or the Client withdraws costs nothing and leaves the free one unused.
- The portal shows the cost before the Client sends a request: free, free as their one Late Reschedule, or the Deposit kept as a fee.
- What a Job owes gains the kept Deposit: a Completed Job owes its price plus any Late Reschedule fee. If that Job is later cancelled, the kept Deposit is not refunded and nothing more is charged, whether or not the cancellation is late.
- The Deposit remains the one fee mechanism (ADR-0001); this only decides when a reschedule triggers it.
