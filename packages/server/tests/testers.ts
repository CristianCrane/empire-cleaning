// The people testing the test site, made Staff there. The seed adds them on
// the test site only, so a reset keeps them; `pnpm staff:testers` adds any
// missing without one (Actions → Add testers). They sign up with their email
// to get in. A tester's Client account is their own sign-up, not made here.
//
//   pnpm staff:testers
import type { StaffRole } from "@empire-cleaning/models";
import { eq } from "drizzle-orm";
import { db } from "#db";
import { createStaff, staff } from "#features/staff";

const TESTERS: { email: string; name: string; roles: StaffRole[] }[] = [
  { email: "ivm4301@gmail.com", name: "Ingrid", roles: ["office_staff"] },
  {
    email: "cristiandcrane@gmail.com",
    name: "Cris Crane",
    roles: ["office_staff"],
  },
  {
    email: "cristiandcrane+cleaner@gmail.com",
    name: "Cris Crane (Cleaner)",
    roles: ["cleaner"],
  },
];

// adds each tester not already on Staff; returns those added
export const addTesters = async () => {
  const added = [];
  for (const tester of TESTERS) {
    const [existing] = await db
      .select()
      .from(staff)
      .where(eq(staff.email, tester.email));
    if (!existing) added.push(await createStaff(tester));
  }
  return added;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const added = await addTesters();
  console.log(
    added.length === 0
      ? "every tester is on Staff already"
      : `added ${added.map((member) => member.email).join(", ")}`,
  );
  process.exit(0);
}
