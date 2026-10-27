import { and, asc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type {
  BookSiteVisitInput,
  CleanerSiteVisits,
  ClientSiteVisit,
  OfficeSiteVisit,
  SiteVisitBooking,
} from "@empire-cleaning/models";
import { db, type Tx } from "../../db/index.ts";
import env from "../../env.ts";
import {
  ConflictError,
  NotFoundError,
  RequestBodyError,
} from "../../middleware/errors.ts";
import {
  addDays,
  atTime,
  clock,
  dayOf,
  startOfDay,
} from "../../services/clock/index.ts";
import {
  compose,
  email,
  firstNameOf,
  formatTime,
  formatWhen,
} from "../../services/email/index.ts";
import { clients, type Client } from "../clients/clients.schema.ts";
import { lockDay } from "../jobs/jobs.ts";
import { roomOn, scheduleFor, visitHours } from "../jobs/schedule.ts";
import { currentPriceList } from "../price-list/price-list.ts";
import { properties, type Property } from "../properties/properties.schema.ts";
import { addressOf, toPropertyView } from "../properties/property-view.ts";
import { warnOfficeOfQuotesWithoutRoom } from "../quotes/quote-room.ts";
import { staff, type Staff } from "../staff/staff.schema.ts";
import { siteVisits } from "./site-visits.schema.ts";
import {
  homeFindingsSchema,
  premisesFindingsSchema,
} from "./site-visits.validation.ts";
import { toSiteVisitView } from "./views.ts";

const fieldError = (path: (string | number)[], message: string) =>
  new RequestBodyError(
    new z.ZodError([{ code: "custom", path, message, input: undefined }]),
  );

const MINUTE_MS = 60_000;

// a Property with its Client
const propertyOf = async (propertyId: string) => {
  const [row] = await db
    .select({ property: properties, client: clients })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, propertyId));
  if (!row) throw new NotFoundError("Property not found");
  return row;
};

// who'd make the visit: anyone active on the Staff
const visitorOf = async (staffId: string) => {
  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.active, true)));
  if (!member) throw fieldError(["staffId"], "Choose someone on the Staff");
  return member;
};

/**
 * Refuses a Site Visit at a time it can't go (ADR-0015), holding its day
 * (lockDay) until the transaction ends, as booking a Job does:
 *
 * - by a Cleaner with Available Hours that day, it takes room like a Job
 *   with a Crew Size of one, its length as its Labour Hours, so the day
 *   needs those hours free and a Cleaner free then;
 * - by Office Staff, it takes none; a Cleaner who isn't Office Staff can't
 *   make one on a day they have no hours;
 * - either way, it can't overlap the visitor's other Site Visits.
 *
 * A visit being moved gives its id, so it isn't counted against itself.
 */
const refuseNoRoom = async (
  tx: Tx,
  {
    startsAt,
    minutes,
    visitor,
    siteVisitId,
  }: {
    startsAt: Date;
    minutes: number;
    visitor: Staff;
    siteVisitId?: string;
  },
) => {
  if (startsAt <= clock.now()) {
    throw new ConflictError("Choose a time that's still to come");
  }
  const date = dayOf(startsAt);
  await lockDay(tx, date);
  const [day] = await scheduleFor(date, date);

  if (day!.available.some((c) => c.id === visitor.id)) {
    const room = roomOn(day!, {
      startsAt,
      labourHours: visitHours({ minutes }),
      crewSize: 1,
      siteVisitId,
    });
    if (!room.hasHours) {
      throw new ConflictError(
        `That day doesn't have room: the Site Visit takes ${visitHours({ minutes })} of ${firstNameOf(visitor.name)}'s Cleaner hours, and ${Math.max(room.freeHours, 0)} are free.`,
      );
    }
    if (!room.hasCrew) {
      throw new ConflictError(
        `Every Cleaner available that day is on a Job then, so ${firstNameOf(visitor.name)} isn't free for a Site Visit.`,
      );
    }
  } else if (!visitor.roles.includes("office_staff")) {
    throw new ConflictError(
      `${visitor.name} has no Available Hours that day, so they can't make a Site Visit then.`,
    );
  }

  const endsAt = new Date(startsAt.getTime() + minutes * MINUTE_MS);
  const [overlap] = await tx
    .select({ startsAt: siteVisits.startsAt })
    .from(siteVisits)
    .where(
      and(
        eq(siteVisits.staffId, visitor.id),
        inArray(siteVisits.status, ["booked", "done"]),
        siteVisitId ? ne(siteVisits.id, siteVisitId) : undefined,
        lt(siteVisits.startsAt, endsAt),
        sql`${siteVisits.startsAt} + make_interval(mins => ${siteVisits.minutes}) > ${startsAt.toISOString()}`,
      ),
    );
  if (overlap) {
    throw new ConflictError(
      `${visitor.name} has another Site Visit then, at ${formatTime(overlap.startsAt!)}.`,
    );
  }
};

// ---- telling the Client ----

const notify = async (what: string, send: () => Promise<void>) => {
  try {
    await send();
  } catch (error) {
    console.error(`${what} not sent:`, error);
  }
};

const place = (property: Property) =>
  property.kind === "commercial" ? "premises" : "home";

// A Client is emailed when a Site Visit is booked, moved or cancelled; they
// ask for changes by phone. One the Office entered without an email isn't.
const tellClient = async (
  client: Client,
  what: string,
  subject: string,
  lines: string[],
) => {
  if (!client.email) return;
  await notify(what, () =>
    email.send({
      to: client.email!,
      subject,
      ...compose([`Hi ${firstNameOf(client.name)},`, ...lines], {
        href: `${env.CORS_ORIGIN_URL}/portal`,
        label: "See it in your account",
      }),
    }),
  );
};

// ---- booking, moving and cancelling ----

/**
 * Office Staff book a Site Visit at a Property for one named Staff member,
 * with no Offer or Confirm (ADR-0015), and the Client is emailed. A
 * Property has one booked at a time.
 */
export const bookSiteVisit = async (
  input: BookSiteVisitInput,
  byAccountId: string,
): Promise<OfficeSiteVisit> => {
  const { property, client } = await propertyOf(input.propertyId);
  const visitor = await visitorOf(input.staffId);
  const startsAt = atTime(input.date, input.time);

  const id = await db.transaction(async (tx) => {
    const [booked] = await tx
      .select({ id: siteVisits.id })
      .from(siteVisits)
      .where(
        and(
          eq(siteVisits.propertyId, property.id),
          eq(siteVisits.status, "booked"),
        ),
      )
      .for("update");
    if (booked) {
      throw new ConflictError(
        "This Property has a Site Visit booked already: move that one instead.",
      );
    }
    await refuseNoRoom(tx, { startsAt, minutes: input.minutes, visitor });
    const [visit] = await tx
      .insert(siteVisits)
      .values({
        propertyId: property.id,
        staffId: visitor.id,
        startsAt,
        minutes: input.minutes,
        bookedAt: clock.now(),
        bookedBy: byAccountId,
      })
      .returning({ id: siteVisits.id });
    return visit!.id;
  });

  await warnOfficeOfQuotesWithoutRoom(input.date);
  await tellClient(
    client,
    `Booking notice for Site Visit ${id}`,
    "Your Site Visit is booked",
    [
      `We've booked a free Site Visit at ${addressOf(property)} for ${formatWhen(startsAt)}. ${firstNameOf(visitor.name)} from Empire Cleaning will come to see the ${place(property)} before we quote, which takes about ${input.minutes} minutes.`,
      "There's no charge. If the time doesn't suit you, please call us to change it.",
    ],
  );
  return officeSiteVisit(id);
};

// a booked Site Visit, held until the transaction ends
const lockBooked = async (tx: Tx, id: string) => {
  const [visit] = await tx
    .select()
    .from(siteVisits)
    .where(eq(siteVisits.id, id))
    .for("update");
  if (!visit) throw new NotFoundError("Site Visit not found");
  if (visit.status !== "booked") {
    throw new ConflictError(
      visit.status === "done"
        ? "This Site Visit is Done: its findings are recorded."
        : "This Site Visit was cancelled.",
    );
  }
  return visit;
};

/**
 * Office Staff move a booked Site Visit to another time, or give it to
 * someone else or a different length, with room for it as booking needs.
 * The Client is emailed.
 */
export const moveSiteVisit = async (
  id: string,
  input: SiteVisitBooking,
): Promise<OfficeSiteVisit> => {
  const visitor = await visitorOf(input.staffId);
  const startsAt = atTime(input.date, input.time);

  const before = await db.transaction(async (tx) => {
    const visit = await lockBooked(tx, id);
    if (
      visit.startsAt!.getTime() === startsAt.getTime() &&
      visit.staffId === visitor.id &&
      visit.minutes === input.minutes
    ) {
      throw new ConflictError("That's how the Site Visit is booked already.");
    }
    await refuseNoRoom(tx, {
      startsAt,
      minutes: input.minutes,
      visitor,
      siteVisitId: id,
    });
    await tx
      .update(siteVisits)
      .set({ startsAt, staffId: visitor.id, minutes: input.minutes })
      .where(eq(siteVisits.id, id));
    return visit;
  });

  await warnOfficeOfQuotesWithoutRoom(input.date);
  const { property, client } = await propertyOf(before.propertyId);
  const moved = before.startsAt!.getTime() !== startsAt.getTime();
  await tellClient(
    client,
    `Move notice for Site Visit ${id}`,
    moved ? "Your Site Visit has moved" : "Your Site Visit has changed",
    [
      moved
        ? `We've moved your free Site Visit at ${addressOf(property)} from ${formatWhen(before.startsAt!)} to ${formatWhen(startsAt)}.`
        : `Your free Site Visit at ${addressOf(property)} is still ${formatWhen(startsAt)}.`,
      `${firstNameOf(visitor.name)} from Empire Cleaning will come then, for about ${input.minutes} minutes. If the time doesn't suit you, please call us to change it.`,
    ],
  );
  return officeSiteVisit(id);
};

// Office Staff cancel a booked Site Visit, and the Client is emailed
export const cancelSiteVisit = async (
  id: string,
  byAccountId: string,
): Promise<OfficeSiteVisit> => {
  const visit = await db.transaction(async (tx) => {
    const visit = await lockBooked(tx, id);
    await tx
      .update(siteVisits)
      .set({
        status: "cancelled",
        cancelledAt: clock.now(),
        cancelledBy: byAccountId,
      })
      .where(eq(siteVisits.id, id));
    return visit;
  });

  const { property, client } = await propertyOf(visit.propertyId);
  await tellClient(
    client,
    `Cancellation notice for Site Visit ${id}`,
    "Your Site Visit is cancelled",
    [
      `We've cancelled your Site Visit at ${addressOf(property)} on ${formatWhen(visit.startsAt!)}.`,
      "If you'd still like us to come and see it, please call us to book another.",
    ],
  );
  return officeSiteVisit(id);
};

// ---- findings ----

/**
 * What a visit found, checked for the Property's kind: business premises'
 * Premises Type (one on offer, or the one they have), floor area and
 * Condition; a home's rooms and Condition. Either may set the Office's
 * notes, which are kept as they are if left out. Returns the Property's
 * columns to set.
 */
const findingsFor = async (property: Property, body: unknown) => {
  if (property.kind === "commercial") {
    const parsed = premisesFindingsSchema.safeParse(body);
    if (!parsed.success) throw new RequestBodyError(parsed.error);
    const { premisesType, ...rest } = parsed.data;
    const list = await currentPriceList();
    if (
      premisesType !== property.premisesTypeKey &&
      !list.premisesTypes.some((t) => t.active && t.key === premisesType)
    ) {
      throw fieldError(
        ["premisesType"],
        "Choose from the types of premises listed",
      );
    }
    return { ...rest, premisesTypeKey: premisesType };
  }
  const parsed = homeFindingsSchema.safeParse(body);
  if (!parsed.success) throw new RequestBodyError(parsed.error);
  const { floorArea, ...rest } = parsed.data;
  return { ...rest, floorArea: floorArea ?? null };
};

/**
 * Records what a booked Site Visit found on its Property, and it's Done.
 * Findings update the Property's price-affecting details, which only Office
 * Staff correct.
 */
export const recordFindings = async (
  id: string,
  body: unknown,
  byAccountId: string,
): Promise<OfficeSiteVisit> => {
  const [found] = await db
    .select({ property: properties })
    .from(siteVisits)
    .innerJoin(properties, eq(properties.id, siteVisits.propertyId))
    .where(eq(siteVisits.id, id));
  if (!found) throw new NotFoundError("Site Visit not found");
  const changes = await findingsFor(found.property, body);

  await db.transaction(async (tx) => {
    await lockBooked(tx, id);
    await tx
      .update(siteVisits)
      .set({ status: "done", doneAt: clock.now(), recordedBy: byAccountId })
      .where(eq(siteVisits.id, id));
    await tx
      .update(properties)
      .set(changes)
      .where(eq(properties.id, found.property.id));
  });
  return officeSiteVisit(id);
};

/**
 * Records findings with no visit booked, for premises Office Staff already
 * know, such as an existing commercial Client's (ADR-0014): a Done Site
 * Visit with no time or visitor. A Property with one booked records them
 * there instead.
 */
export const recordFindingsWithoutVisit = async (
  propertyId: string,
  body: unknown,
  byAccountId: string,
): Promise<OfficeSiteVisit> => {
  const { property } = await propertyOf(propertyId);
  const changes = await findingsFor(property, body);

  const id = await db.transaction(async (tx) => {
    const [booked] = await tx
      .select({ id: siteVisits.id })
      .from(siteVisits)
      .where(
        and(
          eq(siteVisits.propertyId, propertyId),
          eq(siteVisits.status, "booked"),
        ),
      )
      .for("update");
    if (booked) {
      throw new ConflictError(
        "This Property has a Site Visit booked: record its findings there, or cancel it first.",
      );
    }
    const now = clock.now();
    const [visit] = await tx
      .insert(siteVisits)
      .values({
        propertyId,
        status: "done",
        bookedAt: now,
        bookedBy: byAccountId,
        doneAt: now,
        recordedBy: byAccountId,
      })
      .returning({ id: siteVisits.id });
    await tx
      .update(properties)
      .set(changes)
      .where(eq(properties.id, propertyId));
    return visit!.id;
  });
  return officeSiteVisit(id);
};

// The Properties among these with Site Visit findings recorded: a Done
// visit. Business premises can't be Sent a Quote until then (ADR-0014).
export const findingsRecorded = async (propertyIds: string[]) => {
  if (propertyIds.length === 0) return new Set<string>();
  const done = await db
    .selectDistinct({ propertyId: siteVisits.propertyId })
    .from(siteVisits)
    .where(
      and(
        inArray(siteVisits.propertyId, propertyIds),
        eq(siteVisits.status, "done"),
      ),
    );
  return new Set(done.map((d) => d.propertyId));
};

/**
 * Where each Property stands for a Site Visit, before it's quoted: "booked"
 * if one is booked and none is Done yet, "needed" for business premises
 * with neither (ADR-0014), and otherwise nothing, once findings are
 * recorded, or for a home that has none booked.
 */
export const siteVisitStages = async (propertyIds: string[]) => {
  const stages = new Map<string, "needed" | "booked">();
  if (propertyIds.length === 0) return stages;
  const rows = await db
    .select({ id: properties.id, kind: properties.kind })
    .from(properties)
    .where(inArray(properties.id, propertyIds));
  const visits = await db
    .select({ propertyId: siteVisits.propertyId, status: siteVisits.status })
    .from(siteVisits)
    .where(
      and(
        inArray(siteVisits.propertyId, propertyIds),
        inArray(siteVisits.status, ["booked", "done"]),
      ),
    );
  for (const { id, kind } of rows) {
    const own = visits.filter((v) => v.propertyId === id);
    if (own.some((v) => v.status === "done")) continue;
    if (own.some((v) => v.status === "booked")) stages.set(id, "booked");
    else if (kind === "commercial") stages.set(id, "needed");
  }
  return stages;
};

// ---- views ----

// a Site Visit in full, for the Office
export const officeSiteVisit = async (id: string): Promise<OfficeSiteVisit> => {
  const [row] = await db
    .select({
      visit: siteVisits,
      property: properties,
      client: clients,
      visitor: { id: staff.id, name: staff.name },
    })
    .from(siteVisits)
    .innerJoin(properties, eq(properties.id, siteVisits.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .leftJoin(staff, eq(staff.id, siteVisits.staffId))
    .where(eq(siteVisits.id, id));
  if (!row) throw new NotFoundError("Site Visit not found");
  const list = await currentPriceList();
  const { visit, property, client, visitor } = row;
  return {
    ...toSiteVisitView(visit, property, client, visitor),
    property: toPropertyView(property, list),
    officeNotes: property.officeNotes,
  };
};

// a Client's booked Site Visits from today on, soonest first
export const clientSiteVisits = async (
  clientId: string,
): Promise<ClientSiteVisit[]> => {
  const rows = await db
    .select({
      visit: siteVisits,
      property: properties,
      visitor: { name: staff.name },
    })
    .from(siteVisits)
    .innerJoin(properties, eq(properties.id, siteVisits.propertyId))
    .innerJoin(staff, eq(staff.id, siteVisits.staffId))
    .where(
      and(
        eq(properties.clientId, clientId),
        eq(siteVisits.status, "booked"),
        gte(siteVisits.startsAt, startOfDay(dayOf(clock.now()))),
      ),
    )
    .orderBy(asc(siteVisits.startsAt));
  return rows.map(({ visit, property, visitor }) => ({
    id: visit.id,
    startsAt: visit.startsAt!.toISOString(),
    minutes: visit.minutes,
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
    },
    visitorName: firstNameOf(visitor.name),
  }));
};

// a Staff member's own booked Site Visits, today's and those to come
export const visitsFor = async (
  staffId: string,
): Promise<CleanerSiteVisits> => {
  const today = dayOf(clock.now());
  const rows = await db
    .select({ visit: siteVisits, property: properties, client: clients })
    .from(siteVisits)
    .innerJoin(properties, eq(properties.id, siteVisits.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(
      and(
        eq(siteVisits.staffId, staffId),
        eq(siteVisits.status, "booked"),
        gte(siteVisits.startsAt, startOfDay(today)),
      ),
    )
    .orderBy(asc(siteVisits.startsAt));
  const views = rows.map(({ visit, property, client }) => ({
    id: visit.id,
    startsAt: visit.startsAt!.toISOString(),
    minutes: visit.minutes,
    client: {
      id: client.id,
      name: client.name,
      businessName: client.businessName,
      phone: client.phone,
    },
    property: {
      id: property.id,
      street: property.street,
      unit: property.unit,
      postcode: property.postcode,
      accessInstructions: property.accessInstructions,
    },
  }));
  const tomorrow = startOfDay(addDays(today, 1)).toISOString();
  return {
    today: views.filter((v) => v.startsAt < tomorrow),
    upcoming: views.filter((v) => v.startsAt >= tomorrow),
  };
};
