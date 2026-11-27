# Cleaner area screens

Their files are in `packages/web/src/screens/cleaner/`.

## Cleaner > Your jobs

`/cleaner?open=` (`CleanerHome.tsx`), Home: next up, then coming up and done today counted. Keeps: next up large (#154).

## Cleaner > Offers

`/cleaner/offers?tab=` (`CleanerOffers.tsx`), List: Jobs offered or open to them. Keeps: only theirs (#154).

## Cleaner > Job

`/cleaner/jobs/$jobId` (`CleanerJobScreen.tsx`), Record: their Job. Keeps: Confirm sends the time shown, a moved Job saying so (#242); the client's number on the day, once they've confirmed; no Drop out inside 48 hours; Mark done greyed till the crew's confirmed; once done, "How dirty it was", Crew only who confirmed.

## Cleaner > Cleaner needed

`/cleaner/open/$jobId` (`CleanerNeededScreen.tsx`), Record: a Job open to them, to take (#148). Keeps: Confirm as on Cleaner > Job; the city and ZIP code only (`areaOf`), and Crew as how many, never who.
