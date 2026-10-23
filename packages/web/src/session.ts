import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import type { AccountRole, SignedInAccount } from "@empire-cleaning/models";

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

// the signed-in Account, asked of the API once and remembered until sign-out
let current: Promise<SignedInAccount | null> | undefined;

export const getAccount = () =>
  (current ??= fetch("/api/me").then((res) =>
    res.ok ? (res.json() as Promise<SignedInAccount>) : null,
  ));

export const signOut = async () => {
  await authClient.signOut();
  current = undefined;
};

// only paths inside this app, so a crafted ?next= can't send people elsewhere
export const safeNext = (next: string | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
