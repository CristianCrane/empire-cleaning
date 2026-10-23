import { and, eq, isNull } from "drizzle-orm";
import type { AccountRole } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { staff } from "../staff/staff.schema.ts";
import { accounts } from "./auth.schema.ts";

// ADR-0006: an Account is connected to the Client and Staff records whose
// email matches its proven email. A connection is stored once made, so it
// survives either email changing, and is only ever made from a proven email.

type ProvenAccount = { id: string; email: string };

// at sign-up and every sign-in: connects any unconnected records with this
// Account's email, unless it already has a record of that kind
export const connectByEmail = async (account: ProvenAccount) => {
  for (const table of [staff, clients]) {
    const [existing] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.accountId, account.id));
    if (existing) continue;

    await db
      .update(table)
      .set({ accountId: account.id })
      .where(and(eq(table.email, account.email), isNull(table.accountId)));
  }
};

// for a record created after its person already signed up: connects it now
// rather than at their next sign-in
export const connectSignedUpAccount = async (email: string) => {
  const [account] = await db
    .select({ id: accounts.id, email: accounts.email })
    .from(accounts)
    .where(and(eq(accounts.email, email), eq(accounts.emailVerified, true)));
  if (account) await connectByEmail(account);
};

// what an Account may do and the name to greet it by, from its connections
export const accessFor = async (account: { id: string; name: string }) => {
  const [member] = await db
    .select({ name: staff.name, roles: staff.roles })
    .from(staff)
    .where(and(eq(staff.accountId, account.id), eq(staff.active, true)));
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.accountId, account.id));

  const roles: AccountRole[] = [
    ...(member?.roles ?? []),
    ...(client ? (["client"] as const) : []),
  ];
  return { roles, name: member?.name ?? client?.name ?? account.name };
};
