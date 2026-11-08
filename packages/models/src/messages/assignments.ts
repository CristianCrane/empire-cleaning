// What the server and the screens both say about a Cleaner's jobs
// (docs/ux.md, Words)

// a Confirmed Assignment can't be Released this close to the Job: the
// Office needs time to find someone else
export const RELEASE_CUTOFF_HOURS = 48;

export const RELEASE_CLOSED = `It's less than ${RELEASE_CUTOFF_HOURS} hours until this job, so you can't drop out here. Please call the office.`;

// a started Job its crew can't mark done till each of them has confirmed it
export const NOT_ALL_CONFIRMED =
  "Not everyone on this job has confirmed it yet, so it can't be marked done. Please call the office.";
