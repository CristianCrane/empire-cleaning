import { describe, expect, test } from "vitest";
import type { CleanerJob, OfficeJob, OpenPlace } from "@empire-cleaning/models";
import { db } from "#db";
import { emailOpenPlaces } from "#features/assignments";
import { siteVisits } from "#features/site-visits";
import { createStaff, deactivateStaff, setUsualWeek } from "#features/staff";
import { signIn, testClock, testEmail } from "../../../tests/harness.ts";
import { bookedJob, signInAsOffice } from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York (09:00
// UTC). The Job here is at 9am New York on Thursday the 8th, three days
// away: its places are open at once. With 6 Labour Hours and a crew of two,
// it's 9am to noon on site.
const THURSDAY_9AM = "2026-01-08T14:00:00Z";

const cleaner = async (name: string, week = [8, 8, 8, 8, 8, 0, 0]) => {
  const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
  const member = await createStaff({ name, email, roles: ["cleaner"] });
  await setUsualWeek(member.id, week);
  return { ...member, email, signIn: () => signIn(email) };
};

const thursdayJob = (crewSize = 2) =>
  bookedJob({ startsAt: THURSDAY_9AM, labourHours: 6, crewSize });

const openTo = async (agent: Agent) =>
  (await agent.get("/api/assignments/open").expect(200)).body as OpenPlace[];

const openJobIds = async (agent: Agent) =>
  (await openTo(agent)).map((p) => p.jobId);

const jobFor = async (office: Agent, jobId: string) =>
  (await office.get(`/api/jobs/${jobId}`).expect(200)).body as OfficeJob;

const confirm = (agent: Agent, jobId: string) =>
  agent.post(`/api/assignments/open/${jobId}/confirm`);

const offer = (office: Agent, jobId: string, staffId: string) =>
  office.post(`/api/jobs/${jobId}/assignments`).send({ staffId }).expect(201);

// the emails to someone, but for signing in
const subjectsTo = (address: string) =>
  testEmail()
    .to(address)
    .map((m) => m.subject)
    .filter((subject) => !/sign in/i.test(subject));

// a booked Site Visit by a Staff member, at a Job's Property
const siteVisit = async (
  propertyId: string,
  staffId: string,
  startsAt: string,
) => {
  await db.insert(siteVisits).values({
    propertyId,
    staffId,
    startsAt: new Date(startsAt),
    minutes: 60,
    bookedAt: testClock().now(),
  });
};

describe("Open Places", () => {
  test("are open to every free active Cleaner, Office Staff who clean included", async () => {
    const job = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    // no hours on Thursdays
    const fay = await cleaner("Fay Cleaner", [8, 8, 8, 0, 8, 0, 0]);
    const eve = await cleaner("Eve Cleaner");
    await deactivateStaff(eve.id);
    const ana = await createStaff({
      name: "Ana Both",
      email: "ana@example.com",
      roles: ["cleaner", "office_staff"],
    });
    await setUsualWeek(ana.id, [8, 8, 8, 8, 8, 0, 0]);
    const office = await signInAsOffice();

    // what a Cleaner sees before Confirming: no address, Client or prices
    expect(await openTo(await cory.signIn())).toEqual([
      {
        jobId: job.id,
        startsAt: "2026-01-08T14:00:00.000Z",
        serviceName: "Deep Clean",
        hoursOnSite: 3,
        crewSize: 2,
        postcode: "11375",
      },
    ]);
    expect(await openJobIds(await signIn("ana@example.com"))).toEqual([job.id]);
    expect(await openJobIds(await fay.signIn())).toEqual([]);
    expect((await jobFor(office, job.id)).openTo).toEqual({
      opensAt: "2026-01-01T14:00:00.000Z",
      opened: true,
      cleaners: 2,
      passedBy: [],
    });
    // and nothing more of the Job until they hold a place on it
    await (
      await cory.signIn()
    )
      .get(`/api/assignments/mine/${job.id}`)
      .expect(404);
  });

  test("open 7 days before the Job", async () => {
    // 9am on Tuesday the 13th: opens at 9am on Tuesday the 6th
    const job = await bookedJob({
      startsAt: "2026-01-13T14:00:00Z",
      labourHours: 3,
      crewSize: 1,
    });
    const cory = await cleaner("Cory Cleaner");
    const asCory = await cory.signIn();
    const office = await signInAsOffice();

    expect(await openJobIds(asCory)).toEqual([]);
    await asCory.get(`/api/assignments/open/${job.id}`).expect(404);
    const refused = await confirm(asCory, job.id).expect(409);
    expect(refused.body.message).toBe("This Job isn't open to Cleaners yet");
    expect((await jobFor(office, job.id)).openTo).toMatchObject({
      opensAt: "2026-01-06T14:00:00.000Z",
      opened: false,
      cleaners: 0,
    });

    testClock().set(new Date("2026-01-06T14:00:00Z"));
    expect(await openJobIds(asCory)).toEqual([job.id]);
  });

  test("aren't open to anyone holding a Job or Site Visit at the same time", async () => {
    const morning = await thursdayJob();
    // 11am to 1pm, overlapping the morning Job's 9am to noon
    const late = await bookedJob({
      startsAt: "2026-01-08T16:00:00Z",
      labourHours: 2,
      crewSize: 1,
    });
    // from noon, just after it
    const afternoon = await bookedJob({
      startsAt: "2026-01-08T17:00:00Z",
      labourHours: 2,
      crewSize: 1,
    });
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();

    // a named Offer holds a place, as a Confirmation does
    await offer(office, morning.id, cory.id);
    expect(await openJobIds(await cory.signIn())).toEqual([afternoon.id]);
    // Dee is visiting a Property from 1pm
    await siteVisit(late.propertyId, dee.id, "2026-01-08T18:00:00Z");
    expect(await openJobIds(await dee.signIn())).toEqual([morning.id, late.id]);
    expect((await jobFor(office, late.id)).openTo.cleaners).toBe(1);
    expect((await jobFor(office, afternoon.id)).openTo.cleaners).toBe(1);
  });

  test("leave everyone's list once every place is held", async () => {
    const job = await thursdayJob(1);
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();

    await offer(office, job.id, cory.id);
    expect(await openJobIds(await dee.signIn())).toEqual([]);
    expect((await jobFor(office, job.id)).openTo.cleaners).toBe(0);
  });
});

describe("Confirming an Open Place", () => {
  test("takes it, Confirmed at once, and shows the whole Job", async () => {
    const job = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    await cleaner("Dee Cleaner");
    const asCory = await cory.signIn();
    const office = await signInAsOffice();

    const taken = (await confirm(asCory, job.id).expect(200))
      .body as CleanerJob;

    expect(taken).toMatchObject({
      id: job.id,
      property: { street: expect.stringMatching(/Austin St$/) },
      assignment: { status: "confirmed", canRelease: true },
    });
    expect(await openJobIds(asCory)).toEqual([]);
    const seen = await jobFor(office, job.id);
    expect(seen.assignments).toMatchObject([
      {
        staff: { id: cory.id },
        status: "confirmed",
        offeredAt: "2026-01-05T09:00:00.000Z",
        answeredAt: "2026-01-05T09:00:00.000Z",
      },
    ]);
    expect(seen).toMatchObject({ openPlaces: 1, openTo: { cleaners: 1 } });
  });

  test("is refused once someone else took the place", async () => {
    const job = await thursdayJob(1);
    const asCory = await (await cleaner("Cory Cleaner")).signIn();
    const asDee = await (await cleaner("Dee Cleaner")).signIn();

    await confirm(asDee, job.id).expect(200);
    const refused = await confirm(asCory, job.id).expect(409);
    expect(refused.body.message).toBe("Someone else took this Job");
  });

  test("lets only the first of two at once take the last place", async () => {
    const job = await thursdayJob(1);
    const asCory = await (await cleaner("Cory Cleaner")).signIn();
    const asDee = await (await cleaner("Dee Cleaner")).signIn();

    const answers = await Promise.all([
      confirm(asCory, job.id),
      confirm(asDee, job.id),
    ]);
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
  });

  test("is refused to a Cleaner no longer free for it", async () => {
    const job = await thursdayJob();
    const overlapping = await bookedJob({
      startsAt: "2026-01-08T16:00:00Z",
      labourHours: 2,
      crewSize: 1,
    });
    const asCory = await (await cleaner("Cory Cleaner")).signIn();

    await confirm(asCory, overlapping.id).expect(200);
    const refused = await confirm(asCory, job.id).expect(409);
    expect(refused.body.message).toBe("You're no longer free for this Job");
  });
});

describe("Saying an Open Place is not for me", () => {
  test("takes it off their list, shows the Office, and stops emails about it", async () => {
    const job = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const asDee = await dee.signIn();
    const office = await signInAsOffice();

    await asDee.post(`/api/assignments/open/${job.id}/pass`).expect(204);
    await asDee.post(`/api/assignments/open/${job.id}/pass`).expect(204);

    expect(await openJobIds(asDee)).toEqual([]);
    await asDee.get(`/api/assignments/open/${job.id}`).expect(404);
    expect((await jobFor(office, job.id)).openTo).toMatchObject({
      cleaners: 1,
      passedBy: [{ id: dee.id, name: "Dee Cleaner" }],
    });

    testClock().set(new Date("2026-01-05T12:00:00Z"));
    expect(await emailOpenPlaces()).toBe(1);
    expect(subjectsTo(dee.email)).toEqual([]);
    expect(testEmail().lastTo(cory.email).subject).toBe("Jobs open to you");
  });
});

describe("Releasing a Confirmed place", () => {
  test("opens it to every free Cleaner but the one who Released it", async () => {
    const job = await thursdayJob(1);
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const asCory = await cory.signIn();
    const office = await signInAsOffice();
    const taken = (await confirm(asCory, job.id).expect(200))
      .body as CleanerJob;

    await asCory
      .post(`/api/assignments/${taken.assignment.id}/release`)
      .expect(204);

    expect(await openJobIds(asCory)).toEqual([]);
    expect(await openJobIds(await dee.signIn())).toEqual([job.id]);
    const refused = await confirm(asCory, job.id).expect(409);
    expect(refused.body.message).toBe("You released your place on this Job");
    expect((await jobFor(office, job.id)).openTo.cleaners).toBe(1);
  });

  test("of a Job within 48 hours emails everyone free for it at once", async () => {
    // 9am on Tuesday the 6th, 29 hours away
    const job = await bookedJob({
      startsAt: "2026-01-06T14:00:00Z",
      labourHours: 3,
      crewSize: 1,
    });
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    await offer(office, job.id, cory.id);
    const asCory = await cory.signIn();
    const mine = (await asCory.get(`/api/assignments/mine/${job.id}`))
      .body as CleanerJob;

    await asCory
      .post(`/api/assignments/${mine.assignment.id}/release`)
      .expect(204);

    const toDee = testEmail().lastTo(dee.email);
    expect(toDee.subject).toBe("A Job soon is open to you");
    expect(toDee.text).toContain(
      "Deep Clean, Tuesday, January 6 at 9:00 AM, 11375, about 3 hours on site, on your own",
    );
    expect(toDee.text).toContain(
      `http://localhost:5173/cleaner/open/${job.id}`,
    );
    expect(subjectsTo(cory.email)).toEqual(["You've been offered a Job"]);
    // and only once
    expect(await emailOpenPlaces()).toBe(0);
  });
});

describe("The morning email of Open Places", () => {
  test("goes at 7am New York only when something is newly open, new ones first", async () => {
    const thursday = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");

    // 4am: not yet, and Thursday's more than 48 hours away
    expect(await emailOpenPlaces()).toBe(0);

    testClock().set(new Date("2026-01-05T12:00:00Z"));
    expect(await emailOpenPlaces()).toBe(1);
    const first = testEmail().lastTo(cory.email);
    expect(first.subject).toBe("Jobs open to you");
    expect(first.text).toContain("Hi Cory,");
    expect(first.text).toContain(
      "Deep Clean, Thursday, January 8 at 9:00 AM, 11375, about 3 hours on site, crew of 2",
    );
    expect(first.text).toContain(
      `http://localhost:5173/cleaner/open/${thursday.id}`,
    );
    // once a day
    expect(await emailOpenPlaces()).toBe(0);

    // one opening later in the day waits for the next morning
    await bookedJob({
      startsAt: "2026-01-09T14:00:00Z",
      labourHours: 4,
      crewSize: 1,
    });
    testClock().set(new Date("2026-01-05T20:00:00Z"));
    expect(await emailOpenPlaces()).toBe(0);

    testClock().set(new Date("2026-01-06T12:05:00Z"));
    expect(await emailOpenPlaces()).toBe(1);
    const second = testEmail().lastTo(cory.email).text;
    expect(second.indexOf("Friday, January 9")).toBeLessThan(
      second.indexOf("Thursday, January 8"),
    );
    expect(second).toMatch(/http:\/\/localhost:5173\/cleaner\n/);

    // nothing new the day after
    testClock().set(new Date("2026-01-07T12:05:00Z"));
    expect(await emailOpenPlaces()).toBe(0);
    expect(subjectsTo(cory.email)).toEqual([
      "Jobs open to you",
      "Jobs open to you",
    ]);
  });

  test("tries again on the next run if the email fails", async () => {
    await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    testClock().set(new Date("2026-01-05T12:00:00Z"));
    testEmail().failSending();
    expect(await emailOpenPlaces()).toBe(0);
    testEmail().sendNormally();

    // the morning's gone, but the place is still new to them tomorrow
    expect(await emailOpenPlaces()).toBe(0);
    testClock().set(new Date("2026-01-06T12:00:00Z"));
    expect(await emailOpenPlaces()).toBe(1);
    expect(testEmail().lastTo(cory.email).subject).toBe("Jobs open to you");
  });
});

describe("Moving a Job", () => {
  test("keeps its crew where they're free at the new time, and opens the others' places", async () => {
    // 9am on Monday the 12th, so its places aren't open yet
    const job = await bookedJob({
      startsAt: "2026-01-12T14:00:00Z",
      labourHours: 6,
      crewSize: 2,
    });
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const eve = await cleaner("Eve Cleaner");
    const office = await signInAsOffice();
    await offer(office, job.id, cory.id);
    await offer(office, job.id, dee.id);
    // Dee is busy on Thursday morning
    const other = await thursdayJob(1);
    await offer(office, other.id, dee.id);

    await office
      .post(`/api/jobs/${job.id}/move`)
      .send({ date: "2026-01-08", time: "09:00" })
      .expect(200);

    const moved = await jobFor(office, job.id);
    expect(moved.assignments.map((a) => [a.staff.name, a.status])).toEqual([
      ["Cory Cleaner", "offered"],
    ]);
    expect(moved.openPlaces).toBe(1);
    expect(testEmail().lastTo(cory.email).subject).toBe(
      "A Job you're on has moved",
    );
    const toDee = testEmail().lastTo(dee.email);
    expect(toDee.subject).toBe("You're no longer on a Job");
    expect(toDee.text).toContain(
      "to Thursday, January 8 at 9:00 AM, when you aren't free, so you're no longer on it",
    );
    expect(await openJobIds(await eve.signIn())).toEqual([job.id]);
  });
});
