import type { Env } from "../../env.ts";

export type Routing = {
  mode: Env["APP_MODE"];
  // addresses or patterns with * (e.g. the Office inbox's +aliases); empty
  // allows anyone
  allowed: string[];
  office: string;
};

type Addressed = { to: string; bcc?: string; subject: string };

const patternOf = (allowed: string) =>
  new RegExp(
    `^${allowed
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
    "i",
  );

// On the test site (ADR-0020) every subject says so, and mail reaches only
// allowed addresses and the Office inbox: anything else goes to the Office,
// with who it was meant for in the subject, so no stranger is ever emailed.
export const routeEmail = <M extends Addressed>(
  message: M,
  { mode, allowed, office }: Routing,
): M => {
  if (mode !== "test") return message;

  const patterns = allowed.map(patternOf);
  const allows = (address: string) =>
    patterns.length === 0 ||
    address.toLowerCase() === office.toLowerCase() ||
    patterns.some((pattern) => pattern.test(address));

  const { bcc, ...rest } = message;
  const copy = bcc !== undefined && allows(bcc) ? { bcc } : {};

  if (allows(message.to)) {
    return { ...rest, ...copy, subject: `[TEST] ${message.subject}` } as M;
  }
  return {
    ...rest,
    ...copy,
    to: office,
    subject: `[TEST → ${message.to}] ${message.subject}`,
  } as M;
};
