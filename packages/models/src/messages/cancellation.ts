// What the server and the screens both say about cancelling or skipping a
// clean, and about one we couldn't get in for (docs/ux.md, Words)

// cancelling is free until this long before a Job starts; after that it's a
// Late Cancellation
export const CANCELLATION_CUTOFF_HOURS = 24;

// a plan Job skipped or not done: the plan itself is unchanged
export const PLAN_CARRIES_ON = "Your Service Plan carries on as usual.";
