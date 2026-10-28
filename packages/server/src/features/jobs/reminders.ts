import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "../../db/index.ts";
import {
  addDays,
  clock,
  dayOf,
  startOfDay,
  timeOf,
} from "../../services/clock/index.ts";
import { email } from "../../services/email/index.ts";
import { clients } from "../clients/clients.schema.ts";
import { properties } from "../properties/properties.schema.ts";
import { jobs } from "./jobs.schema.ts";
import { cleanOf } from "../services/services.ts";
import { reminderEmail } from "./emails.ts";

// reminders go out from this time, New York, on the day before
export const REMINDER_TIME = "08:00";

/**
 * Emails each Client whose Job is tomorrow (New York) a reminder, once, from
 * 8am today by the Clock. A Job booked today or later gets none: its booking
 * confirmation has only just gone. Safe to run as often as you like, and on
 * more than one server: each Job is claimed before its email goes, and let go
 * again if the email fails, so the next run tries again.
 *
 * Nothing calls this but the timer in src/index.ts (and tests).
 */
export const sendDueReminders = async () => {
  const now = clock.now();
  const today = dayOf(now);
  if (timeOf(now) < REMINDER_TIME) return 0;
  const tomorrow = addDays(today, 1);

  const due = await db
    .select({ job: jobs, property: properties, client: clients })
    .from(jobs)
    .innerJoin(properties, eq(properties.id, jobs.propertyId))
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(
      and(
        eq(jobs.status, "booked"),
        isNull(jobs.reminderSentAt),
        gte(jobs.startsAt, startOfDay(tomorrow)),
        lt(jobs.startsAt, startOfDay(addDays(tomorrow, 1))),
        lt(jobs.bookedAt, startOfDay(today)),
      ),
    );

  let sent = 0;
  for (const { job, property, client } of due) {
    const [claimed] = await db
      .update(jobs)
      .set({ reminderSentAt: now })
      .where(and(eq(jobs.id, job.id), isNull(jobs.reminderSentAt)))
      .returning({ id: jobs.id });
    if (!claimed) continue;

    try {
      await email.send({
        to: client.email,
        ...reminderEmail({
          name: client.name,
          clean: await cleanOf(job, property),
        }),
      });
      sent += 1;
    } catch (error) {
      console.error(`reminder for Job ${job.id} not sent:`, error);
      await db
        .update(jobs)
        .set({ reminderSentAt: null })
        .where(eq(jobs.id, job.id));
    }
  }
  return sent;
};
