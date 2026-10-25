import { and, arrayContains, asc, eq, gte, ne } from "drizzle-orm";
import type {
  AvailabilityException,
  StaffDetail,
  StaffInvitation,
  StaffMember,
  StaffRole,
} from "@empire-cleaning/models";
import { db } from "../../db/index.ts";
import env from "../../env.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock, dayOf } from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import { accounts } from "../auth/auth.schema.ts";
import { connectSignedUpAccount } from "../auth/connections.ts";
import {
  staff,
  staffAvailabilityExceptions,
  staffUsualHours,
  type Staff,
} from "./staff.schema.ts";

type NewStaff = { email: string; name: string; roles: StaffRole[] };

// adds a Staff member (the Office's invitation and the owner setup script).
// If someone has already signed up with this email, their Account is
// connected straight away; otherwise it connects when they sign up.
export const createStaff = async ({ email, name, roles }: NewStaff) => {
  const [member] = await db
    .insert(staff)
    .values({ email: email.trim().toLowerCase(), name, roles })
    .returning();
  await connectSignedUpAccount(member!.email);

  return member!;
};

// imageUrl: the connected Account's picture, from Google
const toMember = (member: Staff, imageUrl: string | null): StaffMember => ({
  id: member.id,
  name: member.name,
  email: member.email,
  roles: member.roles,
  active: member.active,
  signedUp: member.accountId !== null,
  imageUrl,
  createdAt: member.createdAt.toISOString(),
});

// Staff members with their connected Account's picture, if any
const selectStaff = () =>
  db
    .select({ member: staff, imageUrl: accounts.image })
    .from(staff)
    .leftJoin(accounts, eq(accounts.id, staff.accountId));

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// the link only leads to the sign-in page: signing up with this email is what
// connects them, so the email itself grants nothing (ADR-0006)
const sendInvitation = async (member: Staff) => {
  const [firstName] = member.name.split(" ");
  const link = `${env.CORS_ORIGIN_URL}/sign-in`;
  const lines = [
    `Hi ${firstName},`,
    `You've been invited to join Empire Cleaning's Staff. To get started, sign up with this email address (${member.email}), with an emailed link or with Google:`,
  ];
  const after = `If you weren't expecting this, you can ignore this email.`;

  await email.send({
    to: member.email,
    subject: "You're invited to join Empire Cleaning",
    text: [...lines, link, after].join("\n\n"),
    html: [
      ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
      `<p><a href="${link}">Sign up</a></p>`,
      `<p>${escapeHtml(after)}</p>`,
    ].join(""),
  });
};

// Office Staff invite someone by email. Inviting a deactivated Staff member
// again brings them back, with the name and roles given now.
export const inviteStaff = async (
  invitation: StaffInvitation,
): Promise<StaffMember> => {
  const address = invitation.email.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(staff)
    .where(eq(staff.email, address));

  let member: Staff;
  if (!existing) {
    member = await createStaff({ ...invitation, email: address });
  } else if (existing.active) {
    throw new ConflictError(`${existing.name} is already on Staff`);
  } else {
    [member] = (await db
      .update(staff)
      .set({ name: invitation.name, roles: invitation.roles, active: true })
      .where(eq(staff.id, existing.id))
      .returning()) as [Staff];
  }

  try {
    await sendInvitation(member);
  } catch (error) {
    console.error(`invitation to Staff ${member.id} not sent:`, error);
  }
  return (await findStaff(member.id)).view;
};

// everyone ever invited, active first, then by name
export const listStaff = async (): Promise<StaffMember[]> => {
  const rows = await selectStaff().orderBy(asc(staff.name));
  return rows
    .map(({ member, imageUrl }) => toMember(member, imageUrl))
    .sort((a, b) => Number(b.active) - Number(a.active));
};

// the record, and how the Office sees it
const findStaff = async (id: string) => {
  const [found] = await selectStaff().where(eq(staff.id, id));
  if (!found) throw new NotFoundError("Staff member not found");
  return {
    member: found.member,
    view: toMember(found.member, found.imageUrl),
  };
};

// Ends their Staff access at once; their Account, and any Client it's
// connected to, are untouched. The Office can't remove its last member.
export const deactivateStaff = async (id: string) => {
  const { member, view } = await findStaff(id);
  if (!member.active) return view;

  if (member.roles.includes("office_staff")) {
    const [another] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(
        and(
          arrayContains(staff.roles, ["office_staff"]),
          eq(staff.active, true),
          ne(staff.id, id),
        ),
      )
      .limit(1);
    if (!another) {
      throw new ConflictError(
        "Empire Cleaning needs at least one active Office Staff member",
      );
    }
  }

  const [updated] = await db
    .update(staff)
    .set({ active: false })
    .where(eq(staff.id, id))
    .returning();
  return { ...view, active: updated!.active };
};

export const hasOfficeStaff = async () => {
  const [found] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(arrayContains(staff.roles, ["office_staff"]))
    .limit(1);
  return found !== undefined;
};

// ---- availability ----

export const staffDetail = async (id: string): Promise<StaffDetail> => {
  const { view } = await findStaff(id);
  const [usual, exceptions] = await Promise.all([
    db.select().from(staffUsualHours).where(eq(staffUsualHours.staffId, id)),
    db
      .select()
      .from(staffAvailabilityExceptions)
      .where(
        and(
          eq(staffAvailabilityExceptions.staffId, id),
          gte(staffAvailabilityExceptions.date, dayOf(clock.now())),
        ),
      )
      .orderBy(asc(staffAvailabilityExceptions.date)),
  ]);

  const usualWeek = Array.from<number>({ length: 7 }).fill(0);
  for (const { weekday, hours } of usual) usualWeek[weekday] = hours;

  return {
    ...view,
    availability: {
      usualWeek,
      exceptions: exceptions.map(({ date, hours, note }) => ({
        date,
        hours,
        note,
      })),
    },
  };
};

// the hours usually available Monday to Sunday
export const setUsualWeek = async (id: string, usualWeek: number[]) => {
  await findStaff(id);
  await db.transaction(async (tx) => {
    await tx.delete(staffUsualHours).where(eq(staffUsualHours.staffId, id));
    await tx
      .insert(staffUsualHours)
      .values(
        usualWeek.map((hours, weekday) => ({ staffId: id, weekday, hours })),
      );
  });
  return staffDetail(id);
};

// sets (or replaces) the hours for one day
export const setException = async (
  id: string,
  exception: AvailabilityException,
) => {
  await findStaff(id);
  await db
    .insert(staffAvailabilityExceptions)
    .values({ staffId: id, ...exception })
    .onConflictDoUpdate({
      target: [
        staffAvailabilityExceptions.staffId,
        staffAvailabilityExceptions.date,
      ],
      set: { hours: exception.hours, note: exception.note },
    });
  return staffDetail(id);
};

// the day goes back to the usual week
export const removeException = async (id: string, date: string) => {
  await findStaff(id);
  await db
    .delete(staffAvailabilityExceptions)
    .where(
      and(
        eq(staffAvailabilityExceptions.staffId, id),
        eq(staffAvailabilityExceptions.date, date),
      ),
    );
  return staffDetail(id);
};
