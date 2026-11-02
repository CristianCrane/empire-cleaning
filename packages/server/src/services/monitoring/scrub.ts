// Only Client, Staff and Account IDs leave the server (ADR-0007): everything
// sent to Sentry or written to the logs passes through here first.

const REDACTED = "[redacted]";

// keys whose values are personal details, request bodies or secrets, dropped
// wherever they appear. Compared without case, dashes or underscores
const PERSONAL_KEYS = new Set(
  [
    "email",
    "emails",
    "to",
    "bcc",
    "replyTo",
    "phone",
    "address",
    "addressLine1",
    "addressLine2",
    "line1",
    "line2",
    "street",
    "accessInstructions",
    "body",
    "cookie",
    "cookies",
    "setCookie",
    "authorization",
    "queryString",
    "token",
    "secret",
    "password",
    // a failed query's values, which can be anything a Client entered
    "params",
  ].map((key) => normalise(key)),
);

function normalise(key: string) {
  return key.toLowerCase().replace(/[-_]/g, "");
}

// ending in letters, so a package folder in a stack trace
// (drizzle-orm@1.0.0-rc.4_pg@8.23.0) isn't one
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)*\.[a-z]{2,}\b/gi;
// US numbers, as Clients write them: 718-555-0123, (718) 555 0123,
// +1 718.555.0123, 7185550123; not inside longer runs of digits
const PHONE =
  /(?<![\w+])(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\w)/g;
// values in a URL's query, e.g. a sign-in link's token
const QUERY_VALUE = /([?&][^=&#\s]+=)[^&#\s]*/g;
// a failed query's values, in the message Drizzle gives its error
const QUERY_PARAMS = /^params: .*$/gm;

export const scrubText = (text: string) =>
  text
    .replace(EMAIL, "[email]")
    .replace(PHONE, "[phone]")
    .replace(QUERY_VALUE, `$1${REDACTED}`)
    .replace(QUERY_PARAMS, `params: ${REDACTED}`);

// a copy of `value` with personal keys dropped and every string scrubbed;
// Errors keep their type, message, stack and cause
export const scrub = <T>(value: T): T => scrubValue(value, []) as T;

// `within`: the objects being copied, outside this one
const scrubValue = (value: unknown, within: object[]): unknown => {
  if (typeof value === "string") return scrubText(value);
  if (value === null || typeof value !== "object") return value;
  if (within.includes(value)) return "[circular]";
  if (value instanceof Date) return value;

  const inside = [...within, value];
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, inside));
  }

  const copy: Record<string, unknown> = {};
  if (value instanceof Error) {
    copy.type = value.name;
    copy.message = scrubText(value.message);
    if (value.stack) copy.stack = scrubText(value.stack);
    if (value.cause !== undefined) copy.cause = scrubValue(value.cause, inside);
  }
  for (const [key, inner] of Object.entries(value)) {
    if (key in copy) continue;
    copy[key] = PERSONAL_KEYS.has(normalise(key))
      ? REDACTED
      : scrubValue(inner, inside);
  }
  return copy;
};
