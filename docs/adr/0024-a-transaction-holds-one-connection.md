# Inside a transaction every query goes through it; writes that must stand alone use a pool of their own

A transaction holds one database connection, and its locks, until it ends. A query inside it that went through `db` instead of its `tx` took a second connection from the same pool. Under a burst of requests, each holding a connection and its locks while waiting for another, the pool runs dry and every request waits on the others: the API hangs. The scheduling review (#242) found far more of these than the four it named, in the Schedule, room, Open Places, prices, Quotes, balances and completion.

Now everything a transaction reads or writes goes through its `tx`, passed down to whatever it calls. Tests refuse a `db` query inside `db.transaction()` where it's written (`tests/setup/oneConnection.ts`), rather than leaving it to hang under load. Both pools give up waiting for a connection after 10 seconds, so a request that can't get one fails instead of hanging.

A few writes must stand whatever the transaction around them does: a payment attempt is recorded before the provider is asked, and a payer's provider customer once it's made (ADR-0022). They go through `apart`, a pool of three connections that no transaction holds, so they never wait behind one.

We chose this over a larger pool, which only moves the point where it runs dry, and over writing those payment records in the transaction, where a rollback would lose a Charge that stands at the provider.

## Consequences

- A function that a transaction calls takes its `tx` (`Tx | typeof db`, defaulting to `db`), and passes it on.
- A transaction's queries run one after the other, not side by side with `Promise.all`: they share one connection, and pg 9 will refuse a second query while one runs. Tests fail a test that overlaps two, naming where the second was written.
- Only payment attempts and payers use `apart`. Anything else that seems to need it should be looked at again first.
