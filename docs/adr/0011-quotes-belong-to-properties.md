# Quotes belong to Properties

A Quote belongs to a Property, and through it a Client, and a Service Plan Quote may be offered whether or not anyone asked. The First Clean is a trial for both sides, so what follows it is the business's offer, not something the Client asked for, and it needn't resemble the First Clean (another Service, other Add-ons). We chose this over filing the plan offer under the First Clean's request, as the spec had it (#1, story 58): that left the request booked yet still taking Quotes, let a declined plan offer end the request the First Clean was booked on, and would force every later change of plan terms onto a request from months before. A Property's history (its Quotes, Jobs and Service Plan) stays together on the Property instead.

## Consequences

- Quotes come in two kinds, one-off and Service Plan, which can be open side by side. How many a Property may have open, what a First Clean is, and when a plan may be offered: ADR-0018. A Quote holds its own ask: ADR-0017.
- An offer nobody asked for never changes a Quote the Client asked for.
- A Client asking for regular cleaning after their First Clean asks for a Quote as usual, which the Office answers with a Service Plan Quote.
- The Office starts a Service Plan Quote from the completed First Clean Job or from Office > Property.
