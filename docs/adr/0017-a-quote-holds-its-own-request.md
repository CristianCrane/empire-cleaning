# A Quote holds its own request; Revisions replace Superseded Quotes

Quote Requests and Quotes were separate: a request was the Client's ask, and each priced answer to it was its own Quote, with a resend Superseding the last. But Office Staff and Clients think of one thing, "the Quote for Casey's flat", followed from asking to booking; the split put a Requests screen and a separate list of Quotes in front of them, and a row of dead Superseded Quotes behind every resend. So there is one **Quote** for each ask: it keeps what the Client asked for, unchanged, and a series of **Revisions**, each a priced offer that is never changed once Sent, the latest Sent one being the offer. It is merged in the data too, not only on screen: with nothing in production yet the migration costs little, and a model that disagreed with what people say would cost every later change.

This replaces ADR-0011's "a Quote Request is optional": a Quote Office Staff start (for a caller, or a Service Plan Quote nobody asked for) simply has nothing asked recorded, or what the caller said. ADR-0011's other decisions stand: Quotes belong to Properties, a one-off and a Service Plan Quote can be open side by side, and an offer nobody asked for never changes a Quote the Client asked for, because it is a Quote of its own.

## Consequences

- A Quote is _Requested_, _Draft_, _Sent_, _Accepted_, _Declined_, _Expired_ or _Turned Down_. _Superseded_ is gone: an older Revision is history. Drafting changes to a Sent Quote leaves it Sent until the new Revision is sent.
- Only a Client's own ask starts at Requested and sends a receipt; Office Staff's Quotes start at Draft. A Quote's kind, one-off or Service Plan, is set by its first Revision and then fixed.
- A Property has at most one open (Requested, Draft or Sent) Quote of each kind; a Requested Quote, kind not yet set, counts as both, so a Client can't ask again for that Property while one waits. Asking after an Expired Quote starts a new Quote; Office Staff may still revive an Expired one with a new Revision if no newer open Quote of its kind exists.
- Turned Down is only possible before any Revision is Sent; after that the Client's Decline or Expiry closes it. There is no Withdrawn: a Client who changes their mind tells the Office.
- A Site Visit belongs to the Quote it's for; its findings are still recorded on the Property (ADR-0014, ADR-0015).
- Clients see only the latest Sent Revision, and every email links to the Quote, not a Revision; Office Staff see every Revision.
- "Request a Quote" stays as the call to action; "Quote Request" is no longer a thing anyone sees.
