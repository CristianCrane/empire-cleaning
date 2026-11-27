# A city is typed, not looked up

Every address asks for its City beside its ZIP code and keeps it as typed, so a Cleaner reads "Forest Hills, 11375" before Confirming (ADR-0019, #139). The user's calls on 2026-11-27: "A plain City field, not a ZIP-to-town table: a table needs upkeep as ZIP codes change, and a City field costs Clients almost nothing." and "Typos are accepted for now."

This rules out **a ZIP-to-town table** and **checking a city against a list**. Catching typos and duplicate addresses is #579's, an address autocomplete service.

## Consequences

- A Property saved before cities were asked has none, with no backfill: "Properties saved before this show just the ZIP until someone adds a city" (#139). Its address reads without one, a Cleaner reads its ZIP code alone, and Office > Property asks for it.
- A city isn't part of a Property's identity (street, unit and ZIP code, `address.ts`), so the Office corrects it.
