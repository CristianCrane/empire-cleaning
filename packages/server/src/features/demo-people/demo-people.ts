import { and, eq, inArray } from "drizzle-orm";
import type { AccountRole, DemoPerson } from "@empire-cleaning/models";
import { db } from "#db";
import { clients } from "../clients/clients.schema.ts";
import { staff } from "../staff/staff.schema.ts";

// the people of the seed's demo (tests/seed.ts) worth signing in as on the
// test site, found by name, and what being each one shows. The guided tours
// link to them, so the seed checks every one is there.
export const DEMO_PEOPLE = {
  staff: [
    { name: "Jennifer", shows: "Runs the business" },
    {
      name: "Maria Gonzalez",
      shows: "Helen's cleaner, with a job offered to her",
    },
    { name: "Luz Herrera", shows: "Cleans Bell Blvd Pediatrics every week" },
    { name: "Daniela Cruz", shows: "Dropped out of a two-person clean" },
  ],
  clients: [
    { name: "Helen Kowalski", shows: "On a weekly plan" },
    { name: "Sam Ng", shows: "A quote that runs out tomorrow" },
    { name: "Max Rivera", shows: "Offered a plan after a first clean" },
    { name: "Grace Lee", shows: "An extra charge to approve" },
    { name: "Rosa Diaz", shows: "Asked to move a clean" },
    { name: "Tia Moore", shows: "A payment that failed" },
    { name: "Rachel Bell", shows: "Bell Blvd Pediatrics, billed weekly" },
  ],
};

// those of the demo people who are here, in the order above: active Staff
// sign in to their first area (the Office for those holding both roles)
export const demoPeople = async (): Promise<DemoPerson[]> => {
  const members = await db
    .select({ name: staff.name, email: staff.email, roles: staff.roles })
    .from(staff)
    .where(
      and(
        eq(staff.active, true),
        inArray(
          staff.name,
          DEMO_PEOPLE.staff.map((p) => p.name),
        ),
      ),
    );
  const found = await db
    .select({ name: clients.name, email: clients.email })
    .from(clients)
    .where(
      inArray(
        clients.name,
        DEMO_PEOPLE.clients.map((p) => p.name),
      ),
    );
  return [
    ...DEMO_PEOPLE.staff.flatMap(({ name, shows }) => {
      const member = members.find((m) => m.name === name);
      if (!member) return [];
      const role: AccountRole = member.roles.includes("office_staff")
        ? "office_staff"
        : "cleaner";
      return [{ name, email: member.email, role, shows }];
    }),
    ...DEMO_PEOPLE.clients.flatMap(({ name, shows }) => {
      const client = found.find((c) => c.name === name);
      return client?.email
        ? [{ name, email: client.email, role: "client" as const, shows }]
        : [];
    }),
  ];
};
