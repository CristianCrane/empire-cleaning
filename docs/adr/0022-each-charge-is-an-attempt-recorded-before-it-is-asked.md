# Each Charge and refund is an attempt, recorded before the provider is asked

A Charge was asked for inside the transaction that recorded it, with a new random idempotency key each time. When the provider took the money but its reply was lost, or the transaction then rolled back, nothing recorded the Charge: the Job or Bill still looked owed, and the retry, under a new key, charged the Client again. The same held for a Deposit taken on acceptance (#241).

Now every payment off a saved card, and every Deposit, is a Charge attempt, committed in its own transaction before the provider is asked, with its own idempotency key. What the provider answered is written to it straight after. The next try for the same Job, Bill or Quote first asks after any attempt it never heard the end of, or that took money no Charge records. Within a day, while the provider still replays a key's first reply, it asks again with the same key and the same request. After that, it looks the payment up by the key, which every payment carries in its metadata. Money an attempt took is recorded as a Charge then, and counts towards what's owed; only the rest is asked for. An attempt declined is over, so the next try asks the card afresh.

We chose this over a key that's only stable across retries, which the provider forgets after a day and which replays a stored error. And over moving every call out of the caller's transaction, a bigger change that still needs a stable key for a lost reply.

## Consequences

- Taking money never throws for want of the provider: a lost reply, or an earlier attempt still unknown, comes back as "the payment provider couldn't be reached". The Job or Bill is Unpaid, and nothing more is asked for until the attempt is known. The Client accepting a Quote is told to try again in a few minutes.
- A Deposit an earlier try took is the Deposit if it was for as much and the card it saved, if any, is known. Otherwise it's given back, and a new one taken.
- A payment still processing (no card does this off-session, but the provider allows it) isn't a decline: its attempt waits, and the next try asks how it ended.
- Refunds are attempts the same way (`refund_attempts`): a refund the provider made but no Refund records is recorded by the next try for the same Job, Bill or credit, never given again. Neither table holds references, as each is written outside the transaction that holds what it's for.
- When Stripe may have done something after all (the connection failed, Stripe erred, or the same key's request is still in progress), the adapter throws rather than calling it a refusal, so the attempt waits to be asked about.
- Once a Job settles after a change to it, settling never undoes the change. If it throws, the error is reported and the Job is Unpaid until a retry settles it. One Bill that fails in the weekly run stops no other.
