# Each Charge and refund is an attempt, recorded before the provider is asked

A Charge was asked for inside the transaction that recorded it, with a new random idempotency key each time. When the provider took the money but its reply was lost, or the transaction then rolled back, nothing recorded the Charge: the Job or Bill still looked owed, and the retry, under a new key, charged the Client again (#241).

Now every payment off a saved card, every Deposit, every payment on Client portal > Bill, and every refund is an attempt, committed in its own transaction before the provider is asked, with its own idempotency key, every key built in one place (`features/payments/keys.ts`). The next try for the same Job, Bill or Quote first asks after any attempt it never heard the end of, and only then works out what's owed, so what a lost reply took counts however things have changed since.

A next try comes from the Client or the Office (trying again, saving a new card, accepting again), from anything that changes what's owed, or from the Clock every 10 minutes, so nobody has to. Each try holds the Job, Bill or Quote it's for, so tries at once take turns.

A key is sent again only within a day, while the provider still replays its first reply, and only for the same request: as much, on the card the Client has now. Otherwise the attempt is looked up by its key ([Advanced error handling](https://docs.stripe.com/error-low-level#content-errors)); not found a quarter hour after it was last sent, it was never made, and what's owed now is asked under a new attempt.

We chose this over a key that's only stable across retries, which the provider forgets after a day and which replays a stored error. And over moving every call out of the caller's transaction, a bigger change that still needs a stable key for a lost reply.

## Consequences

- Taking money never throws for want of the provider: the Job or Bill is Unpaid, and nothing more is asked for or given back until the attempt is known.
- A Deposit an earlier try took is the Deposit if it was for as much. Otherwise it's given back before another is taken, never two at once.
- A payment still processing isn't a decline: its attempt waits, and the next try asks how it ended.
- An off-session payment the Client's bank wants them to approve is a failed attempt, Unpaid, which the Client confirms on its page with them there (ADR-0008, Bank approval), the user's call (#534 Q7).
- When Stripe may have done something after all (the connection failed, Stripe erred, the same key's request is still in progress), or hasn't done it yet (a 429), the adapter throws rather than calling it a refusal, so the attempt waits to be asked about. Our key refused throws too: it's ours to fix, not the Client's card.
- Once a Job settles after a change to it, settling never undoes the change. One Bill that fails in the weekly run stops no other.
- **One rule**: while a payment on a Job, Bill or Quote may still take the money, nothing else that moves money on it starts. Each page greys what waits and says why, and the server refuses a page opened before. The owner, 2026-11-23: "Yes, I think the one rule makes sense" (#534).
