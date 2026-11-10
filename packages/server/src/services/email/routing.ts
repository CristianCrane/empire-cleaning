import type { Env } from "../../env.ts";

export type Routing = {
  mode: Env["APP_MODE"];
  // addresses or patterns with * (e.g. the Office inbox's +aliases); empty
  // allows anyone
  allowed: string[];
  office: string;
};

type Addressed = { to: string; subject: string };

const patternOf = (allowed: string) =>
  new RegExp(
    `^${allowed
      .split("*")
      .map((part) => RegExp.escape(part))
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

  if (allows(message.to)) {
    return { ...message, subject: `[TEST] ${message.subject}` };
  }
  return {
    ...message,
    to: office,
    subject: `[TEST → ${message.to}] ${message.subject}`,
  };
};
