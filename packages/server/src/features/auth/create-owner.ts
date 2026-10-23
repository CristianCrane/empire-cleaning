import { createStaff, hasOfficeStaff } from "../staff/staff.ts";

// bootstraps the first Office Staff member; everyone else is invited from
// there. The owner then signs up with this email, which connects them.
export async function createOwner({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  if (await hasOfficeStaff()) {
    throw new Error(
      "an Office Staff member already exists; invite further Staff from the app",
    );
  }

  return createStaff({ email, name, roles: ["office_staff"] });
}

const isRunningFromTerminal = import.meta.url === `file://${process.argv[1]}`;

if (isRunningFromTerminal) {
  const [email, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ");
  if (!email || !name) {
    console.error("usage: pnpm auth:create-owner <email> <full name>");
    process.exit(1);
  }

  try {
    const owner = await createOwner({ email, name });
    console.log(
      `created Office Staff member ${owner.email}; sign up with that email to get in`,
    );
    process.exit(0);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
