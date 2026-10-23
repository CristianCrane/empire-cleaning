# Accounts come only from signing up; Clients and Staff are connected by proven email

An Account is created only when a person signs up, by emailed link or Google, so its email is always proven. Clients and Staff are separate records: a Guest's Quote Request creates a Client, and an Office Staff invitation creates a Staff member, neither with an Account. An Account is connected automatically to any Client or Staff record whose email matches its proven email, at sign-up or any later sign-in, and stays connected if either email changes afterwards.

We first created Accounts on people's behalf (with the Quote Request, by invitation), which left every Account unproven until its first sign-in. That forced the first sign-in to be an emailed link, because Better Auth rightly refuses to link Google to an unproven Account. It also left a Guest with an Account they couldn't use, and pushed Quote emails towards long-lived sign-in links. Separating the sign-in identity from the business records removes all three: no unproven Accounts exist, so there's nothing to protect, and Google works as a first sign-in.

## Considered Options

- **Keep creating Accounts with the Quote Request and invitation, and relax Better Auth's linking rule** (`requireLocalEmailVerified: false`): rejected. It works only while nothing can grant access before the email is proven, and Better Auth's own rule exists to stop someone inheriting access an impostor set up.
- **Require sign-up before a Quote Request**: rejected for Client friction. Asking for a price should need nothing but contact details.

## Consequences

- Anyone may sign up. An Account connected to nothing sees the Quote Request form, and a pointer to sign in with the email they used if they asked for a Quote before.
- Quote emails link to the Quote's page and carry no sign-in power. A signed-in browser shows the Quote; otherwise the person signs in and returns to it. This replaces ADR-0002's "every Quote email carries a link that signs them in straight to that Quote".
- One Account may be connected to both a Client and Staff.
- Roles live on the Staff record, not the Account. Being a Client comes from the connection to a Client.
- A Guest's Quote Request with an existing Client's email is added to that Client without changing their details.
- Without self-service merging, someone who signs up with a different email from their Quote Request needs Office Staff to correct the Client's email.
