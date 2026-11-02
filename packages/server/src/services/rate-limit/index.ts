import { business } from "@empire-cleaning/models";
import { clock } from "#services/clock";
import env, { type Env } from "../../env.ts";

// How often an open form may email one address (#32), so no one's inbox is
// flooded through us. Per email address, never per network address: behind
// Render that comes from a header whose handling isn't documented
const LIMITS = {
  signInLink: { tries: 6, minutes: 15 },
  guestQuoteRequest: { tries: 6, minutes: 24 * 60 },
} as const satisfies Record<string, Limit>;

type Limit = { tries: number; minutes: number };
export type LimitName = keyof typeof LIMITS;

type Verdict =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  // counts a try at `name` for `key`, unless it's one too many
  attempt(name: LimitName, key: string): Verdict;
}

// counts in memory: there is one server process (ADR-0020)
class MemoryRateLimiter implements RateLimiter {
  private readonly tries = new Map<string, number[]>();
  private sweptAt = 0;

  private readonly limits: Record<LimitName, Limit>;

  constructor(limits: Record<LimitName, Limit>) {
    this.limits = limits;
  }

  attempt(name: LimitName, key: string): Verdict {
    const { tries, minutes } = this.limits[name];
    const window = minutes * 60_000;
    const now = clock.now().getTime();
    this.sweep(now);

    const id = `${name}:${key}`;
    const recent = (this.tries.get(id) ?? []).filter((at) => at > now - window);
    // a refused try isn't counted, so the wait ends when the oldest try
    // leaves the window, however often they press
    if (recent.length >= tries) {
      this.tries.set(id, recent);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((recent[0]! + window - now) / 1000),
      };
    }
    this.tries.set(id, [...recent, now]);
    return { allowed: true };
  }

  // forgets, once a minute, whoever hasn't tried within the longest window
  private sweep(now: number) {
    if (now - this.sweptAt < 60_000) return;
    this.sweptAt = now;
    const longest =
      Math.max(...Object.values(this.limits).map((l) => l.minutes)) * 60_000;
    for (const [id, tries] of this.tries) {
      if (tries.at(-1)! <= now - longest) this.tries.delete(id);
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
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const hours = Math.ceil(minutes / 60);
  const wait =
    minutes < 60
      ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}`
      : `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `Too many tries. Please try again in ${wait}, or call us on ${business.phone.display}.`;
};
