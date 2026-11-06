import { and, arrayContains, asc, eq, gt, gte, inArray, ne } from "drizzle-orm";
import type {
  AvailabilityException,
  StaffDetail,
  StaffHolding,
  StaffInvitation,
  StaffMember,
  StaffRole,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import { ConflictError, NotFoundError } from "../../middleware/errors.ts";
import { clock, dayOf, weekdayOf } from "../../services/clock/index.ts";
import {
  email,
  firstNameOf,
  formatWhen,
  notify,
  type Email,
} from "../../services/email/index.ts";
import { assignments, onCrew } from "../assignments/assignments.schema.ts";
import { takenOffEmail } from "../assignments/emails.ts";
import {
  emailCleanersNeeded,
  cleanerNeededAgain,
} from "../assignments/cleaners-needed.ts";
import { accounts } from "../auth/auth.schema.ts";
import { jobs, type Job } from "../jobs/jobs.schema.ts";
import { lockDay } from "../jobs/jobs.ts";
import { connectSignedUpAccount } from "../auth/connections.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf } from "../properties/property-view.ts";
import { warnOfficeOfQuotesWithoutRoom } from "../quotes/quote-room.ts";
import { cleanOf, serviceVersions } from "../services/services.ts";
import { siteVisits } from "../site-visits/site-visits.schema.ts";
import { staffInviteEmail } from "./emails.ts";
import {
  staff,
  staffAvailabilityExceptions,
  staffUsualHours,
  type Staff,
} from "./staff.schema.ts";
import { monitoring } from "../../services/monitoring/index.ts";

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

  // as connecting left it
  return (await findStaff(member!.id)).member;
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
const selectStaff = (tx: Tx | typeof db = db) =>
  tx
    .select({ member: staff, imageUrl: accounts.image })
    .from(staff)
    .leftJoin(accounts, eq(accounts.id, staff.accountId));

const sendInvitation = async (member: Staff) => {
  await email.send({
    to: member.email,
    ...staffInviteEmail({ name: member.name, email: member.email }),
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
    monitoring.error(error, {
      what: `invitation to Staff ${member.id} not sent`,
    });
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

// the record, and how the Office sees it; held until the transaction ends,
// if one is given, so their hours and crews change one way at a time
const findStaff = async (id: string, tx?: Tx) => {
  const query = selectStaff(tx).where(eq(staff.id, id));
  const [found] = await (tx ? query.for("update", { of: staff }) : query);
  if (!found) throw new NotFoundError("Staff member not found");
  return {
    member: found.member,
    view: toMember(found.member, found.imageUrl),
  };
};

// refuses to take the last active Office Staff member away
const keepAnotherOffice = async (id: string, tx: Tx | typeof db = db) => {
  const [another] = await tx
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
};

// Their name and roles, as the Office corrects them; their access follows
// at once. The Office keeps an active member, and a Cleaner on the crew of a
// Job to come keeps the role until they've let it go.
export const editStaff = async (
  id: string,
  { name, roles }: { name: string; roles: StaffRole[] },
) => {
  const { member, view } = await findStaff(id);

  if (
    member.active &&
    member.roles.includes("office_staff") &&
    !roles.includes("office_staff")
  )
    await keepAnotherOffice(id);

  if (member.roles.includes("cleaner") && !roles.includes("cleaner")) {
    const [held] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .innerJoin(jobs, eq(jobs.id, assignments.jobId))
      .where(
        and(
          eq(assignments.staffId, id),
          onCrew(),
          eq(jobs.status, "booked"),
          gt(jobs.startsAt, clock.now()),
        ),
      )
      .limit(1);
    if (held) {
      throw new ConflictError(
        `${member.name} holds a place on a Job to come: release it first`,
      );
    }
  }

  const [updated] = await db
    .update(staff)
    .set({ name, roles })
    .where(eq(staff.id, id))
    .returning();
  return { ...view, name: updated!.name, roles: updated!.roles };
};

/**
 * Ends their Staff access at once; their Account, and any Client it's
 * connected to, are untouched. The Office can't remove its last member.
 * Their Assignments to Jobs to come are Released, opening to every free Cleaner
 * (#242). A Site Visit they're making has to go to someone else first.
 */
export const deactivateStaff = async (id: string) => {
  const { view, freed } = await db.transaction(async (tx) => {
    const { member, view } = await findStaff(id, tx);
    if (!member.active) return { view, freed: [] };

    if (member.roles.includes("office_staff")) {
      await keepAnotherOffice(id, tx);
    }
    const holding = await heldBy(tx, id);
    refuseSiteVisits(
      member,
      holding.filter((h) => h.kind === "site_visit"),
    );
    const freed = await releaseHeld(
      tx,
      holding.filter((h) => h.kind === "job"),
    );

    const [updated] = await tx
      .update(staff)
      .set({ active: false })
      .where(eq(staff.id, id))
      .returning();
    return { view: { ...view, active: updated!.active }, freed };
  });
  await afterFreeing(freed);
  // a Cleaner's hours are gone from every day
  if (view.roles.includes("cleaner")) await warnOfficeOfQuotesWithoutRoom();
  return view;
};

// Emails a notice to every Office Staff member, built once. A send that
// fails is logged and the rest still go; the change stands (notify).
export const tellOfficeStaff = (what: string, notice: () => Promise<Email>) =>
  notify(what, async () => {
    const built = await notice();
    for (const to of await officeStaffEmails()) {
      await notify(`${what} for ${to}`, () => email.send({ to, ...built }));
    }
  });

// where notices for the Office go: every active Office Staff member
const officeStaffEmails = async () =>
  (
    await db
      .select({ email: staff.email })
      .from(staff)
      .where(
        and(
          arrayContains(staff.roles, ["office_staff"]),
          eq(staff.active, true),
        ),
      )
  ).map((s) => s.email);

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
  const [usual, exceptions, holding] = await Promise.all([
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
    heldBy(db, id),
  ]);
  const versions = await serviceVersions(
    holding.flatMap((h) => (h.kind === "job" ? [h.job.serviceId] : [])),
  );

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
    holding: holding.map((h): StaffHolding =>
      h.kind === "job"
        ? {
            kind: "job",
            id: h.job.id,
            startsAt: h.startsAt.toISOString(),
            what: versions.get(h.job.serviceId)!.name,
            where: h.where,
          }
        : {
            kind: "site_visit",
            id: h.siteVisitId,
            startsAt: h.startsAt.toISOString(),
            what: "Site Visit",
            where: h.where,
          },
    ),
  };
};

// ---- what they hold, and freeing it ----

type Held =
  | {
      kind: "job";
      startsAt: Date;
      where: string;
      assignmentId: string;
      job: Job;
      property: Property;
    }
  | { kind: "site_visit"; startsAt: Date; where: string; siteVisitId: string };

// what a Staff member holds from now on, soonest first: their Assignments
// to booked Jobs to come, Offered or Confirmed, and the booked Site Visits
// they're making
const heldBy = async (tx: Tx | typeof db, id: string): Promise<Held[]> => {
  const now = clock.now();
  // one after the other: a transaction's queries can't overlap
  const onJobs = await tx
    .select({ assignment: assignments, job: jobs, property: properties })
    .from(assignments)
    .innerJoin(jobs, eq(jobs.id, assignments.jobId))
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .where(
      and(
        eq(assignments.staffId, id),
        onCrew(),
        eq(jobs.status, "booked"),
        gt(jobs.startsAt, now),
      ),
    );
  const visits = await tx
    .select({ visit: siteVisits, property: properties })
    .from(siteVisits)
    .innerJoin(properties, eq(properties.id, siteVisits.propertyId))
    .where(
      and(
        eq(siteVisits.staffId, id),
        eq(siteVisits.status, "booked"),
        gt(siteVisits.startsAt, now),
      ),
    );
  return [
    ...onJobs.map(({ assignment, job, property }): Held => ({
      kind: "job",
      startsAt: job.startsAt,
      where: addressOf(property),
      assignmentId: assignment.id,
      job,
      property,
    })),
    ...visits.map(({ visit, property }): Held => ({
      kind: "site_visit",
      startsAt: visit.startsAt!,
      where: addressOf(property),
      siteVisitId: visit.id,
    })),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
};

// A Site Visit has a named visitor and no Cleaner Needed, so it can't be freed:
// it has to go to someone else first
const refuseSiteVisits = (member: Staff, visits: Held[]) => {
  const [visit] = visits;
  if (!visit) return;
  throw new ConflictError(
    `${firstNameOf(member.name)} has a Site Visit at ${visit.where} on ${formatWhen(visit.startsAt)}. Give it to someone else first.`,
  );
};

// Releases Assignments, inside the transaction freeing them; returns them
const releaseHeld = async (tx: Tx, held: Held[]) => {
  const ids = held.flatMap((p) => (p.kind === "job" ? [p.assignmentId] : []));
  if (ids.length === 0) return [];
  const now = clock.now();
  await tx
    .update(assignments)
    .set({ status: "released", answeredAt: now })
    .where(and(inArray(assignments.id, ids), onCrew()));
  return held;
};

// once saved: the Jobs freed need a Cleaner again, and anyone free for one
// within 48 hours hears of it at once
const afterFreeing = async (freed: Held[]) => {
  if (freed.length === 0) return;
  for (const held of freed) {
    if (held.kind === "job") await cleanerNeededAgain(held.job.id);
  }
  await notify("Cleaners Needed email", async () => {
    await emailCleanersNeeded();
  });
};

// their hours on each of these days: one that differs, or their usual week
const hoursOn = async (tx: Tx, id: string, days: string[]) => {
  if (days.length === 0) return new Map<string, number>();
  const usual = await tx
    .select()
    .from(staffUsualHours)
    .where(eq(staffUsualHours.staffId, id));
  const exceptions = await tx
    .select()
    .from(staffAvailabilityExceptions)
    .where(
      and(
        eq(staffAvailabilityExceptions.staffId, id),
        inArray(staffAvailabilityExceptions.date, days),
      ),
    );
  const usualOf = new Map(usual.map((u) => [u.weekday, u.hours]));
  const exceptionOf = new Map(exceptions.map((e) => [e.date, e.hours]));
  return new Map(
    days.map((day) => [
      day,
      exceptionOf.get(day) ?? usualOf.get(weekdayOf(day)) ?? 0,
    ]),
  );
};

/**
 * Inside the transaction changing a Cleaner's hours: frees what they hold
 * on days they now have none (#158, #242). Their Assignments there are
 * Released, opening to every other free Cleaner, and they're told. A Site
 * Visit there is refused instead, unless they're Office Staff, who need no
 * hours to make one. Returns the Assignments freed.
 */
const freeDaysOff = async (tx: Tx, member: Staff) => {
  const holding = await heldBy(tx, member.id);
  const hours = await hoursOn(tx, member.id, [
    ...new Set(holding.map((h) => dayOf(h.startsAt))),
  ]);
  const off = holding.filter((h) => hours.get(dayOf(h.startsAt)) === 0);
  if (!member.roles.includes("office_staff")) {
    refuseSiteVisits(
      member,
      off.filter((h) => h.kind === "site_visit"),
    );
  }
  return releaseHeld(
    tx,
    off.filter((h) => h.kind === "job"),
  );
};

// once a change to their hours is saved: what it freed, and the Cleaner hears
// which Jobs they're off
const afterHoursChanged = async (member: Staff, freed: Held[]) => {
  await afterFreeing(freed);
  for (const held of freed) {
    if (held.kind !== "job") continue;
    await notify(
      `Removal from Job ${held.job.id} to Staff ${member.id}`,
      async () =>
        email.send({
          to: member.email,
          ...takenOffEmail({
            name: member.name,
            clean: await cleanOf(held.job, held.property),
          }),
        }),
    );
  }
};

// the hours usually available Monday to Sunday; a weekday going to 0 frees
// what they hold on those days to come (freeDaysOff)
export const setUsualWeek = async (id: string, usualWeek: number[]) => {
  const { member, freed } = await db.transaction(async (tx) => {
    const { member } = await findStaff(id, tx);
    await tx.delete(staffUsualHours).where(eq(staffUsualHours.staffId, id));
    await tx
      .insert(staffUsualHours)
      .values(
        usualWeek.map((hours, weekday) => ({ staffId: id, weekday, hours })),
      );
    return { member, freed: await freeDaysOff(tx, member) };
  });
  await afterHoursChanged(member, freed);
  await warnOfficeOfQuotesWithoutRoom();
  return staffDetail(id);
};

// Sets (or replaces) the hours for one day, holding the day as bookings do,
// so none takes room the change takes away. Going to 0 frees what they hold
// that day (freeDaysOff).
export const setException = async (
  id: string,
  exception: AvailabilityException,
) => {
  const { member, freed } = await db.transaction(async (tx) => {
    const { member } = await findStaff(id, tx);
    await lockDay(tx, exception.date);
    await tx
      .insert(staffAvailabilityExceptions)
      .values({ staffId: id, ...exception })
      .onConflictDoUpdate({
        target: [
          staffAvailabilityExceptions.staffId,
          staffAvailabilityExceptions.date,
        ],
        set: { hours: exception.hours, note: exception.note },
      });
    return { member, freed: await freeDaysOff(tx, member) };
  });
  await afterHoursChanged(member, freed);
  await warnOfficeOfQuotesWithoutRoom(exception.date);
  return staffDetail(id);
};

// the day goes back to the usual week, which may free what they hold that
// day, as setException does
export const removeException = async (id: string, date: string) => {
  const { member, freed } = await db.transaction(async (tx) => {
    const { member } = await findStaff(id, tx);
    await lockDay(tx, date);
    await tx
      .delete(staffAvailabilityExceptions)
      .where(
        and(
          eq(staffAvailabilityExceptions.staffId, id),
          eq(staffAvailabilityExceptions.date, date),
        ),
      );
    return { member, freed: await freeDaysOff(tx, member) };
  });
  await afterHoursChanged(member, freed);
  await warnOfficeOfQuotesWithoutRoom(date);
  return staffDetail(id);
};

// the active Staff member a signed-in Account is connected to
export const staffForAccount = async (accountId: string) => {
  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.accountId, accountId), eq(staff.active, true)));
  if (!member) throw new NotFoundError("Staff member not found");
  return member;
};
