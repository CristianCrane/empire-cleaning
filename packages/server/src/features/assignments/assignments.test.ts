import { describe, expect, test } from "vitest";
import type {
  CleanerJob,
  CleanerJobs,
  NeedsAttentionItem,
  OfficeJob,
  OfficeQuote,
  ScheduleDay,
} from "@empire-cleaning/models";
import { createStaff, setUsualWeek } from "#features/staff";
import { api, signIn, testClock, testEmail } from "../../../tests/harness.ts";
import {
  bookedJob,
  casey,
  guestRequest,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

type Agent = Awaited<ReturnType<typeof signIn>>;

// the test clock starts at 4am on Monday 5 January 2026 in New York (09:00
// UTC). Jobs here are at 9am New York on Thursday the 8th unless a test says
// otherwise: more than 48 hours away.
const THURSDAY_9AM = "2026-01-08T14:00:00Z";

const cleaner = async (name: string) => {
  const email = `${name.split(" ")[0]!.toLowerCase()}@example.com`;
  const member = await createStaff({ name, email, roles: ["cleaner"] });
  await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
  return { ...member, email, signIn: () => signIn(email) };
};

const thursdayJob = (crewSize = 2) =>
  bookedJob({ startsAt: THURSDAY_9AM, labourHours: 6, crewSize });

const jobFor = async (office: Agent, jobId: string) =>
  (await office.get(`/api/jobs/${jobId}`).expect(200)).body as OfficeJob;

const offer = (office: Agent, jobId: string, staffId: string) =>
  office.post(`/api/jobs/${jobId}/assignments`).send({ staffId });

// Offers a place and returns the new Assignment's id
const offered = async (office: Agent, jobId: string, staffId: string) => {
  const job = (await offer(office, jobId, staffId).expect(201))
    .body as OfficeJob;
  return job.assignments.find((a) => a.staff.id === staffId)!.id;
};

const myJobs = async (agent: Agent) =>
  (await agent.get("/api/assignments/mine").expect(200)).body as CleanerJobs;

const ids = async (agent: Agent) => {
  const { today, upcoming } = await myJobs(agent);
  return { today: today.map((j) => j.id), upcoming: upcoming.map((j) => j.id) };
};

const myJob = async (agent: Agent, jobId: string) =>
  (await agent.get(`/api/assignments/mine/${jobId}`).expect(200))
    .body as CleanerJob;

const needsAttention = async (office: Agent) =>
  (await office.get("/api/dashboard/needs-attention").expect(200))
    .body as NeedsAttentionItem[];

describe("Offering Assignments", () => {
  test("is only for Office Staff", async () => {
    const job = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    await api().get(`/api/jobs/${job.id}`).expect(401);
    const asCory = await cory.signIn();
    await asCory.get(`/api/jobs/${job.id}`).expect(403);
    await offer(asCory, job.id, cory.id).expect(403);
  });

  test("starts each place Offered and emails the Cleaner", async () => {
    const job = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();

    const before = await jobFor(office, job.id);
    expect(before).toMatchObject({
      assignment: "unassigned",
      assignments: [],
      openPlaces: 2,
      // only Cleaners, with their hours that day
      cleaners: [
        { id: cory.id, name: "Cory Cleaner", hours: 8 },
        { id: dee.id, name: "Dee Cleaner", hours: 8 },
      ],
    });

    const after = (await offer(office, job.id, cory.id).expect(201))
      .body as OfficeJob;

    expect(after.assignments).toEqual([
      {
        id: expect.any(String),
        staff: { id: cory.id, name: "Cory Cleaner" },
        status: "offered",
        offeredAt: "2026-01-05T09:00:00.000Z",
        answeredAt: null,
      },
    ]);
    expect(after.openPlaces).toBe(1);
    expect(after.cleaners.map((c) => c.name)).toEqual(["Dee Cleaner"]);
    expect(after.assignment).toBe("unassigned");

    const email = testEmail().lastTo(cory.email);
    expect(email.subject).toBe("You've been offered a Job");
    expect(email.text).toContain("Hi Cory,");
    expect(email.text).toMatch(
      /Deep Clean at \d+ Austin St, 4B, 11375, Thursday, January 8 at 9:00 AM/,
    );
    expect(email.text).toContain(
      `http://localhost:5173/cleaner/jobs/${job.id}`,
    );
  });

  test("lets Office Staff who clean take a place themselves, Confirmed at once", async () => {
    const job = await thursdayJob();
    const ana = await createStaff({
      name: "Ana Both",
      email: "ana@example.com",
      roles: ["cleaner", "office_staff"],
    });
    const asAna = await signIn("ana@example.com");
    const sent = testEmail().sent.length;

    const after = (await offer(asAna, job.id, ana.id).expect(201))
      .body as OfficeJob;

    expect(after.assignments[0]).toMatchObject({
      status: "confirmed",
      answeredAt: "2026-01-05T09:00:00.000Z",
    });
    expect(testEmail().sent).toHaveLength(sent);
  });

  test("is refused when every place is held", async () => {
    const job = await thursdayJob(1);
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    await offered(office, job.id, cory.id);

    const refused = await offer(office, job.id, dee.id).expect(409);

    expect(refused.body.message).toBe("This Job's place is taken");
    expect((await jobFor(office, job.id)).cleaners).toEqual([
      { id: dee.id, name: "Dee Cleaner", hours: 8 },
    ]);
  });

  test("is refused for someone already on the Job, or who isn't an active Cleaner", async () => {
    const job = await thursdayJob(3);
    const cory = await cleaner("Cory Cleaner");
    const gone = await cleaner("Gil Gone");
    const office = await signInAsOffice();
    const otto = await createStaff({
      name: "Otto Office",
      email: "otto@example.com",
      roles: ["office_staff"],
    });
    await office.post(`/api/staff/${gone.id}/deactivate`).expect(200);
    await offered(office, job.id, cory.id);

    expect(
      (await offer(office, job.id, cory.id).expect(409)).body.message,
    ).toBe("Cory Cleaner already has a place on this Job");
    expect(
      (await offer(office, job.id, otto.id).expect(409)).body.message,
    ).toBe("Otto Office isn't an active Cleaner");
    expect(
      (await offer(office, job.id, gone.id).expect(409)).body.message,
    ).toBe("Gil Gone isn't an active Cleaner");
    await offer(office, job.id, crypto.randomUUID()).expect(404);
    await offer(office, crypto.randomUUID(), cory.id).expect(404);
    await office.post(`/api/jobs/${job.id}/assignments`).send({}).expect(400);
  });

  test("is refused once the Job has started", async () => {
    const job = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    testClock().set(new Date(THURSDAY_9AM));

    expect(
      (await offer(office, job.id, cory.id).expect(409)).body.message,
    ).toBe("This Job has already started");
  });

  test("shows the Add-ons on the Quote the Client accepted", async () => {
    await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const { body: request } = await submit(guestRequest()).expect(201);
    const draft = (
      await office
        .post("/api/quotes")
        .send({ quoteRequestId: request.id })
        .expect(201)
    ).body as OfficeQuote;
    const oven = draft.addOnChoices.find((a) => a.name === "Inside the oven")!;
    await office
      .patch(`/api/quotes/${draft.id}`)
      .send({
        addOns: [oven.key],
        crewSize: 1,
        depositPercent: draft.depositPercent,
        validityDays: draft.validityDays,
        proposedStart: { date: "2026-01-08", time: "09:00" },
        overrides: { deep: null, standard: null },
      })
      .expect(200);
    await office.post(`/api/quotes/${draft.id}/send`).expect(200);
    const client = await signIn(casey.email);
    const form = (
      await client.post("/api/payment-methods/mine/card-form").expect(200)
    ).body as { secret: string };
    await client
      .put("/api/payment-methods/mine")
      .send({ token: form.secret })
      .expect(200);
    await client
      .post(`/api/quotes/mine/${draft.id}/accept`)
      .send({ cleanType: "standard" })
      .expect(200);
    const [day] = (
      await office
        .get("/api/schedule?from=2026-01-08&to=2026-01-08")
        .expect(200)
    ).body as ScheduleDay[];

    expect((await jobFor(office, day!.jobs[0]!.id)).addOns).toEqual([
      "Inside the oven",
    ]);
  });
});

describe("removing an Assignment", () => {
  test("frees the place and tells the Cleaner", async () => {
    const job = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();
    await asCory.post(`/api/assignments/${assignmentId}/confirm`).expect(200);

    const after = (
      await office
        .delete(`/api/jobs/${job.id}/assignments/${assignmentId}`)
        .expect(200)
    ).body as OfficeJob;

    expect(after.assignments).toEqual([]);
    expect(after.openPlaces).toBe(2);
    const email = testEmail().lastTo(cory.email);
    expect(email.subject).toBe("You're no longer on a Job");
    expect(email.text).toContain("You don't need to go.");
    expect(await ids(asCory)).toEqual({ today: [], upcoming: [] });
    await office
      .delete(`/api/jobs/${job.id}/assignments/${assignmentId}`)
      .expect(404);
  });
});

describe("a Cleaner's Jobs", () => {
  test("are those they hold a place on, today and to come, soonest first", async () => {
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    const thursday = await thursdayJob();
    const today = await bookedJob({
      startsAt: "2026-01-05T15:00:00Z",
      labourHours: 2,
      crewSize: 1,
    });
    const deesOnly = await thursdayJob();
    const released = await thursdayJob();
    await offered(office, thursday.id, cory.id);
    await offered(office, today.id, cory.id);
    await offered(office, deesOnly.id, dee.id);
    const letGo = await offered(office, released.id, cory.id);
    const asCory = await cory.signIn();
    await asCory.post(`/api/assignments/${letGo}/release`).expect(204);

    expect(await ids(asCory)).toEqual({
      today: [today.id],
      upcoming: [thursday.id],
    });

    // yesterday's are gone, and Thursday's is today's when it comes
    testClock().set(new Date("2026-01-06T09:00:00Z"));
    expect(await ids(asCory)).toEqual({ today: [], upcoming: [thursday.id] });
    testClock().set(new Date("2026-01-08T09:00:00Z"));
    expect(await ids(asCory)).toEqual({ today: [thursday.id], upcoming: [] });
  });

  test("show only where, what, who with and the Client's first name; the phone only on the day", async () => {
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    const job = await thursdayJob();
    const assignmentId = await offered(office, job.id, cory.id);
    await offered(office, job.id, dee.id);
    const asCory = await cory.signIn();

    const seen = await myJob(asCory, job.id);

    expect(seen).toEqual({
      id: job.id,
      startsAt: "2026-01-08T14:00:00.000Z",
      cleanType: "deep",
      hoursOnSite: 3,
      addOns: [],
      property: {
        street: expect.stringMatching(/^\d+ Austin St$/),
        unit: "4B",
        postcode: "11375",
        accessInstructions: "Ring 4B; the doorman has a key.",
      },
      client: { firstName: "Client", phone: null },
      crew: [
        { name: "Cory Cleaner", status: "offered" },
        { name: "Dee Cleaner", status: "offered" },
      ],
      assignment: { id: assignmentId, status: "offered", canRelease: true },
      outcome: null,
      started: false,
      canComplete: false,
      // a Job no Quote booked has nothing to report
      reportable: { quoted: [], others: [] },
      completion: null,
    });
    expect(JSON.stringify(seen)).not.toMatch(/cents|price|deposit|payment/i);

    // the morning of the Job, New York time
    testClock().set(new Date("2026-01-08T05:30:00Z"));
    expect((await myJob(asCory, job.id)).client.phone).toBe(casey.phone);
  });

  test("are hidden from Cleaners not on them", async () => {
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    const job = await thursdayJob();
    const assignmentId = await offered(office, job.id, cory.id);
    const asDee = await dee.signIn();

    await asDee.get(`/api/assignments/mine/${job.id}`).expect(404);
    await asDee.post(`/api/assignments/${assignmentId}/confirm`).expect(404);
    await asDee.post(`/api/assignments/${assignmentId}/release`).expect(404);
    expect(await ids(asDee)).toEqual({ today: [], upcoming: [] });
    // and from anyone who isn't a Cleaner
    await office.get("/api/assignments/mine").expect(403);
    await api().get("/api/assignments/mine").expect(401);
  });
});

describe("Confirming", () => {
  test("takes the place, and a Job is assigned once every place is Confirmed", async () => {
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    const job = await thursdayJob();
    const coryPlace = await offered(office, job.id, cory.id);
    const deePlace = await offered(office, job.id, dee.id);
    const asCory = await cory.signIn();
    const asDee = await dee.signIn();
    testClock().advance({ hours: 1 });

    const seen = (
      await asCory.post(`/api/assignments/${coryPlace}/confirm`).expect(200)
    ).body as CleanerJob;

    expect(seen.assignment.status).toBe("confirmed");
    expect((await jobFor(office, job.id)).assignments[0]).toMatchObject({
      status: "confirmed",
      answeredAt: "2026-01-05T10:00:00.000Z",
    });
    expect((await jobFor(office, job.id)).assignment).toBe("unassigned");

    await asDee.post(`/api/assignments/${deePlace}/confirm`).expect(200);
    // again changes nothing
    await asDee.post(`/api/assignments/${deePlace}/confirm`).expect(200);

    expect((await jobFor(office, job.id)).assignment).toBe("assigned");
    const [thursday] = (
      await office
        .get("/api/schedule?from=2026-01-08&to=2026-01-08")
        .expect(200)
    ).body as ScheduleDay[];
    expect(thursday!.jobs[0]!.assignment).toBe("assigned");
  });
});

describe("Releasing", () => {
  test("frees the place and emails the Office", async () => {
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const job = await thursdayJob();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();

    await asCory.post(`/api/assignments/${assignmentId}/release`).expect(204);

    const after = await jobFor(office, job.id);
    expect(after.assignments).toMatchObject([
      { status: "released", answeredAt: "2026-01-05T09:00:00.000Z" },
    ]);
    expect(after.openPlaces).toBe(2);
    await asCory.get(`/api/assignments/mine/${job.id}`).expect(404);
    // and they can be Offered it again
    expect(after.cleaners.map((c) => c.id)).toEqual([cory.id]);
    await offer(office, job.id, cory.id).expect(201);

    const email = testEmail().lastTo("olive@example.com");
    expect(email.subject).toBe("Cory Cleaner released a place on a Job");
    expect(email.text).toMatch(
      /Cory Cleaner has released their place on the Deep Clean at \d+ Austin St/,
    );
    expect(email.text).toContain(`http://localhost:5173/office/jobs/${job.id}`);
  });

  test("of an Offered place is allowed right up to the Job", async () => {
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const job = await thursdayJob();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();
    testClock().set(new Date("2026-01-08T13:00:00Z"));

    expect((await myJob(asCory, job.id)).assignment.canRelease).toBe(true);
    await asCory.post(`/api/assignments/${assignmentId}/release`).expect(204);
  });

  test("of a Confirmed place is refused within 48 hours of the Job", async () => {
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const job = await thursdayJob();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();
    await asCory.post(`/api/assignments/${assignmentId}/confirm`).expect(200);

    // 48 hours to go: still allowed
    testClock().set(new Date("2026-01-06T14:00:00Z"));
    expect((await myJob(asCory, job.id)).assignment.canRelease).toBe(true);

    testClock().advance({ minutes: 1 });
    expect((await myJob(asCory, job.id)).assignment.canRelease).toBe(false);
    const refused = await asCory
      .post(`/api/assignments/${assignmentId}/release`)
      .expect(409);
    expect(refused.body.message).toBe(
      "A Confirmed place can't be released within 48 hours of the Job. Please call the Office.",
    );
    expect((await myJob(asCory, job.id)).assignment.status).toBe("confirmed");
  });
});

describe("Unassigned Jobs in Needs attention", () => {
  test("are those within 48 hours whose places aren't all Confirmed, soonest first", async () => {
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    // booked at the clock's start, 4am Monday
    const wednesday = await bookedJob({
      startsAt: "2026-01-07T14:00:00Z",
      labourHours: 2,
      crewSize: 1,
    });
    const today = await bookedJob({
      startsAt: "2026-01-05T20:00:00Z",
      labourHours: 2,
      crewSize: 1,
    });
    const covered = await bookedJob({
      startsAt: "2026-01-06T14:00:00Z",
      labourHours: 2,
      crewSize: 1,
    });
    // more than 48 hours away
    await thursdayJob();
    const place = await offered(office, covered.id, cory.id);
    const asCory = await cory.signIn();
    await asCory.post(`/api/assignments/${place}/confirm`).expect(200);
    // Wednesday 9am comes within 48 hours at Monday 9am
    testClock().set(new Date("2026-01-05T15:00:00Z"));

    const items = (await needsAttention(office)).filter(
      (i) => i.kind === "job_unassigned",
    );

    expect(items.map((i) => i.job.id)).toEqual([today.id, wednesday.id]);
    expect(items[0]).toMatchObject({
      since: "2026-01-05T09:00:00.000Z",
      job: { assignment: "unassigned", client: { name: expect.any(String) } },
    });
    expect(items[1]!.since).toBe("2026-01-05T14:00:00.000Z");
  });
});
