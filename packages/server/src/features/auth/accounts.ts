import { arrayContains } from "drizzle-orm";
import type { AccountRole } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { accounts } from "./auth.schema.ts";

type NewAccount = {
  email: string;
  name: string;
  roles: AccountRole[];
};

// Accounts are created by our own flows (Quote Request, Staff invite, owner
// setup), never by signing in; people then sign in with a one-time link
export const createAccount = async ({ email, name, roles }: NewAccount) => {
  if (roles.includes("client") && roles.length > 1) {
    throw new Error("a Client Account cannot also hold Staff roles");
  }

  const [account] = await db
    .insert(accounts)
    .values({ email: email.trim().toLowerCase(), name, roles })
    .returning();
  return account!;
};

export const hasOfficeStaff = async () => {
  const [found] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(arrayContains(accounts.roles, ["office_staff"]))
    .limit(1);
  return found !== undefined;
};
