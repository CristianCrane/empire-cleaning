import { createAccount, hasOfficeStaff } from "./accounts.ts";

// bootstraps the first Office Staff Account; everyone else is invited from there
export async function createOwner({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  if (await hasOfficeStaff()) {
    throw new Error(
      "an Office Staff Account already exists; invite further Staff from the app",
    );
  }

  return createAccount({ email, name, roles: ["office_staff"] });
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
    const account = await createOwner({ email, name });
    console.log(
      `created Office Staff Account for ${account.email}; sign in with a one-time link`,
    );
    process.exit(0);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
