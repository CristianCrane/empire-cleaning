# Services replace Clean Types, each with its own pricing, versioned apart from the Price List

The owner wants to add, change and retire what they sell without a developer, Painting next, which isn't cleaning at all. So a Job is of a **Service**, from a list Office Staff keep, in place of the Clean Types fixed in code.

A Service is priced from a home's rooms, at its own hours for each, times Condition, or by area, at its hours per 1,000 sq ft. Either gives Labour Hours, so Crew Size and Schedule room work for every Service, priced at its own hourly rate and Minimum Charge and taxed at its own rates. We chose a figure for each part over one multiplier on room hours, too abstract for the owner to set: every figure should be one they can picture ("a bathroom takes about an hour on a deep clean"). And over a straight price per square foot, which gives no idea how long a Job takes, and an "Office-priced" method, as the override already covers a Job neither fits. A Premises Type multiplies a by-area Service's hours, so every such Service gets each Premises Type free; it and Condition apply only where the Service says Condition applies, so Painting changes with neither. The area is on the Revision, prefilled from the Property's floor area, as Painting is priced on the area painted, and homes have none.

What used to follow from the kind of Property or the Clean Type (who a Service is for, whether it can recur, whether it needs a Site Visit, which Service to recommend first) is data on the Service, as hard-coding "Standard → Deep" or "commercial needs a Site Visit" would break once the owner renamed or retired one.

Each Service is versioned on its own, not the whole list as one set, as Services are edited one at a time. A Revision records the Service version beside the Price List version, so changing either never reprices a Sent Quote, a Service Plan or a booked Job, and ADR-0009's Adjustments price from those versions.

## Consequences

- A one-off Quote is for one Service, which Office Staff may change, with its recommended one beside it at a Property with no Completed Job.
- A Property has at most one open one-off Quote per Service, and one open Service Plan Quote; a Requested Quote blocks only its own Service, and the Service Plan Quote if that Service can recur. This replaces ADR-0011's and ADR-0017's one Quote of each kind.
- A Service Plan is of one Service that can recur, on all its days, not one per day as ADR-0013's Clean Types were, as a plan is agreed as one thing ("a Standard Clean every week"). The cost: one plan per Property, so a monthly Deep Clean beside a weekly Standard Clean is a one-off Quote.
- A First Clean is the first Completed one-off Job of a Service that can recur. A Service Plan of a Service that needs a Site Visit needs the visit's findings instead. This replaces ADR-0011's First Clean and plan offer, and ADR-0014's commercial rules.
- Tax rates, one-off and plan, are on each Service; the Price List keeps only the rate for fees. Add-ons say which Services they go with.
- Retiring a Service only stops new Quotes for it: what's open on it carries on at the version it used.
- Every Service has the same Job lifecycle and any Cleaner can do any Job, until there's a painter on staff.
- The landing page's "What we clean" stays static copy (ADR-0005).
