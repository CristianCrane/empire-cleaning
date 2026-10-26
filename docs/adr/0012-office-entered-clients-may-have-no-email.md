# A Client the Office enters for a caller may have no email

Office Staff quote people who phone (#34): they find the caller among the Clients or enter them, describe the home, and land in a Quote Draft. Some callers have no email, or won't give one, so a Client the Office enters needs only a name and phone. Their Quote Request is recorded as usual, marked as entered by the Office, and no receipt is emailed, because the Office is quoting them straight away.

A Client without an email has no way in. An Account needs a proven email matching theirs (ADR-0006), a Quote goes by email and is accepted signed in (ADR-0008), and every notice is an email. So a Quote for such a Client can be drafted but not sent, and the Quote screen says why. Office Staff add the email on the Client screen, and from then on everything works as for any Client, including connecting an Account that signed up with that email. An email can be changed but never removed, so a Client who had one keeps one.

## Considered Options

- **Require an email for every Client**: rejected for Client friction. Office Staff would have to invent one, or turn a caller away, before they could even price the job.
- **Let the Office send a Quote by other means (read out by phone, or by text) and record acceptance for the caller**: rejected for now. Accepting needs a saved Payment Method, which only the Client can enter (ADR-0008), so it would need a payment link sent somehow anyway. It can come later with texting.

## Consequences

- `clients.email` may be null. Emails to a Client without one are simply not sent; with sending refused for their Quotes, they can't reach the steps whose emails matter.
- Payers (Stripe customers) can be created without an email.
- A caller's request with an existing Client's email is added to that Client without changing their details, as a Guest's is.
