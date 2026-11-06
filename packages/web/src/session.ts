import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import type { AccountRole, Me, SignedInAccount } from "@empire-cleaning/models";
import { identify } from "@empire-cleaning/browser-monitoring";

// Better Auth's browser client: plain functions over the API's /api/auth
// endpoints (same origin; Vite forwards /api to the server), no UI of its own
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });

// the three parts of the app, each for one role. For Staff holding both
// roles, the Office comes first.
export const areas = {
  office: { role: "office_staff", label: "Office", path: "/office" },
  cleaner: { role: "cleaner", label: "Cleaner area", path: "/cleaner" },
  portal: { role: "client", label: "Client portal", path: "/portal" },
} as const satisfies Record<
  string,
  { role: AccountRole; label: string; path: string }
>;

export type AreaId = keyof typeof areas;

export const areasFor = (account: SignedInAccount): AreaId[] =>
  (Object.keys(areas) as AreaId[]).filter((id) =>
    account.roles.includes(areas[id].role),
  );

// the signed-in Account, with the first-time help tours it has seen, asked
// of the API and remembered, not asked on every click. It is asked again
// when the person switches area or returns to the tab (see router.tsx and
// main.tsx), and after something that can connect their Account to a record
// or changes the tours seen (forgetAccount).
let current: Promise<Me | null> | undefined;

export const getAccount = () =>
  (current ??= fetch("/api/me")
    .then((res) => (res.ok ? (res.json() as Promise<Me>) : null))
    .then((account) => {
      // Sentry knows people by Account ID only (ADR-0007)
      identify(account?.id);
      return account;
    }));

// asks the API again next time it is needed, e.g. after becoming a Client
export const forgetAccount = () => {
  current = undefined;
};

export const signOut = async () => {
  await authClient.signOut();
  forgetAccount();
  identify(undefined);
};

// only paths inside this app, so a crafted ?next= can't send people elsewhere
export const safeNext = (next: string | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
