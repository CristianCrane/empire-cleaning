// What the server and the screens both say about a Cleaner's jobs
// (docs/ux.md, Words)

// a Confirmed Assignment can't be Released this close to the Job: the
// Office needs time to find someone else
export const RELEASE_CUTOFF_HOURS = 48;

export const RELEASE_CLOSED = `It's less than ${RELEASE_CUTOFF_HOURS} hours until this job, so you can't release it here. Please call the office.`;
