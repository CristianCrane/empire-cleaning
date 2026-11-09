import { business, DAY_MS, HOUR_MS, MINUTE_MS } from "@empire-cleaning/models";
import { clock } from "#services/clock";
import { monitoring } from "#services/monitoring";
import env, { type Env } from "../../env.ts";

// How often an open form may email one address (#32), so no one's inbox is
// flooded through us, and how often the whole site may, so a script typing
// thousands of addresses can't use up the email quota and stop real links,
// receipts and reminders (#243). Per email address, never per network
// address: behind Render that comes from a header whose handling isn't
// documented. The site-wide caps are well above a busy hour's real use
const LIMITS = {
  signInLink: {
    perInbox: { tries: 6, window: 15 * MINUTE_MS },
    siteWide: { tries: 100, window: HOUR_MS },
  },
  guestQuoteRequest: {
    perInbox: { tries: 6, window: DAY_MS },
    siteWide: { tries: 30, window: HOUR_MS },
  },
  // a Client's link to confirm a new email (#243)
  emailChange: {
    perInbox: { tries: 6, window: DAY_MS },
    siteWide: { tries: 20, window: HOUR_MS },
  },
} as const satisfies Record<string, Limits>;

// so many tries within a window of so many ms
type Limit = { tries: number; window: number };
type Limits = { perInbox: Limit; siteWide: Limit };
export type LimitName = keyof typeof LIMITS;

type Verdict =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  // counts a try at `name` for `key`, unless it's one too many
  attempt(name: LimitName, key: string): Verdict;
}

// counts in memory: there is one server process (ADR-0020), and a deploy
// starting the counts afresh is rare enough
class MemoryRateLimiter implements RateLimiter {
  private readonly tries = new Map<string, number[]>();
  private sweptAt = 0;
  // when each site-wide cap was last said to be reached
  private readonly toldAt = new Map<LimitName, number>();

  private readonly limits: Record<LimitName, Limits>;

  constructor(limits: Record<LimitName, Limits>) {
    this.limits = limits;
  }

  attempt(name: LimitName, key: string): Verdict {
    const { perInbox, siteWide } = this.limits[name];
    const now = clock.now().getTime();
    this.sweep(now);

    // an inbox's key always has an @, so none is the whole site's
    const mine = this.recent(`${name}:${key}`, perInbox, now);
    const all = this.recent(`${name}:*`, siteWide, now);
    // a refused try counts toward neither, so the wait ends when the oldest
    // try leaves the window, however often they press
    const wait = Math.max(mine.wait, all.wait);
    if (wait > 0) {
      if (all.wait > 0) this.tellCapReached(name, siteWide, now);
      return { allowed: false, retryAfterSeconds: Math.ceil(wait / 1000) };
    }
    mine.count(now);
    all.count(now);
    return { allowed: true };
  }

  // the tries at `id` still within the limit's window, how long until
  // another is allowed (0 if it is now), and a way to count one
  private recent(id: string, { tries, window }: Limit, now: number) {
    const recent = (this.tries.get(id) ?? []).filter((at) => at > now - window);
    this.tries.set(id, recent);
    return {
      wait: recent.length >= tries ? recent[0]! + window - now : 0,
      count: (at: number) => recent.push(at),
    };
  }

  // real people are being turned away, so it's urgent, but once a window is
  // enough: a flood mustn't use up the monitoring quota too
  private tellCapReached(name: LimitName, { window }: Limit, now: number) {
    const told = this.toldAt.get(name);
    if (told !== undefined && now - told < window) return;
    this.toldAt.set(name, now);
    monitoring.signal("rate_cap_reached", { limit: name });
  }

  // forgets, once a minute, whoever hasn't tried within the longest window
  private sweep(now: number) {
    if (now - this.sweptAt < MINUTE_MS) return;
    this.sweptAt = now;
    const longest = Math.max(
      ...Object.values(this.limits).flatMap((l) => [
        l.perInbox.window,
        l.siteWide.window,
      ]),
    );
    for (const [id, tries] of this.tries) {
      if ((tries.at(-1) ?? 0) <= now - longest) this.tries.delete(id);
    }
  }
}

const unlimited: RateLimiter = { attempt: () => ({ allowed: true }) };

// production only: dev's suites sign in many times, and on the test site the
// owner tries things over and over from one inbox, while its email allowlist
// keeps strangers out (#127). From APP_MODE, never a setting, so production
// can't be loosened by mistake
export const rateLimiterFor = (mode: Env["APP_MODE"]): RateLimiter =>
  mode === "prod" ? new MemoryRateLimiter(LIMITS) : unlimited;

let current: RateLimiter = rateLimiterFor(env.APP_MODE);

export const setRateLimiter = (next: RateLimiter) => {
  current = next;
};

// one inbox, however its address is written: case, a +tag and the dots in a
// Gmail address don't make another
export const inboxOf = (email: string) => {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  const name = address.slice(0, at).split("+")[0]!;
  const domain = address.slice(at + 1);
  return domain === "gmail.com" || domain === "googlemail.com"
    ? `${name.replaceAll(".", "")}@gmail.com`
    : `${name}@${domain}`;
};

export const rateLimit = {
  // counts a try at `name` for the inbox `email` reaches
  attempt: (name: LimitName, email: string) =>
    current.attempt(name, inboxOf(email)),
};

// what someone refused is told, the wait rounded up: "5 minutes", "3 hours"
export const tooManyTries = (retryAfterSeconds: number) => {
  const minutes = Math.ceil((retryAfterSeconds * 1000) / MINUTE_MS);
  const hours = Math.ceil((retryAfterSeconds * 1000) / HOUR_MS);
  const wait =
    minutes * MINUTE_MS < HOUR_MS
      ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}`
      : `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `Too many tries. Please try again in ${wait}, or call us on ${business.phone.display}.`;
};
