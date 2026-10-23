import { arrayContains, eq } from "drizzle-orm";
import type { StaffRole } from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import { connectSignedUpAccount } from "../auth/connections.ts";
import { staff } from "./staff.schema.ts";

type NewStaff = { email: string; name: string; roles: StaffRole[] };

// adds a Staff member (the Office's invitation, #7, and the owner setup
// script). If someone has already signed up with this email, their Account
// is connected straight away; otherwise it connects when they sign up.
export const createStaff = async ({ email, name, roles }: NewStaff) => {
  const [member] = await db
    .insert(staff)
    .values({ email: email.trim().toLowerCase(), name, roles })
    .returning();
  await connectSignedUpAccount(member!.email);

  return member!;
};

export const deactivateStaff = async (id: string) => {
  await db.update(staff).set({ active: false }).where(eq(staff.id, id));
};

export const hasOfficeStaff = async () => {
  const [found] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(arrayContains(staff.roles, ["office_staff"]))
    .limit(1);
  return found !== undefined;
};
