import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  CleanerJob,
  CleanerJobs,
  NeedsAttentionItem,
  OfficeJob,
  OfficeQuote,
  CleanerNeeded,
  ScheduleDay,
} from "@empire-cleaning/models";
import { apart } from "#db";
import { assignments } from "#features/assignments";
import { jobs } from "#features/jobs";
import { siteVisits } from "#features/site-visits";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  type Agent,
  api,
  signIn,
  testClock,
  testEmail,
} from "../../../tests/harness.ts";
import {
  bookedJob,
  casey,
  guestAsk,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "#features/services";

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

// Offers a Job and returns the new Assignment's id
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

  test("starts each Assignment Offered and emails the Cleaner", async () => {
    const job = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();

    const before = await jobFor(office, job.id);
    expect(before).toMatchObject({
      assignment: "unassigned",
      assignments: [],
      cleanersNeeded: 2,
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
    expect(after.cleanersNeeded).toBe(1);
    expect(after.cleaners.map((c) => c.name)).toEqual(["Dee Cleaner"]);
    expect(after.assignment).toBe("unassigned");

    const email = testEmail().lastTo(cory.email);
    expect(email.subject).toBe("You've been offered a Job");
    expect(email.text).toContain("Hi Cory,");
    expect(email.text).toMatch(
      /When: Thursday, January 8 at 9:00 AM\nWhere: \d+ Austin St, 4B, 11375\nService: Deep Clean/,
    );
    expect(email.text).toContain(
      `http://localhost:5173/cleaner/jobs/${job.id}`,
    );
  });

  test("lets Office Staff who clean put themselves on the crew, Confirmed at once", async () => {
    const job = await thursdayJob();
    const ana = await createStaff({
      name: "Ana Both",
      email: "ana@example.com",
      roles: ["cleaner", "office_staff"],
    });
    await setUsualWeek(ana.id, [8, 8, 8, 8, 8, 0, 0]);
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

  test("is refused when the crew is whole", async () => {
    const job = await thursdayJob(1);
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    await offered(office, job.id, cory.id);

    const refused = await offer(office, job.id, dee.id).expect(409);

    expect(refused.body.message).toBe("This Job already has its Cleaner");
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
    ).toBe("Cory Cleaner is already on this Job");
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
    ).toBe("This clean has already started, so you can't offer it to anyone.");
  });

  test("shows the Add-ons on the Quote the Client accepted", async () => {
    await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const { body: request } = await submit(guestAsk()).expect(201);
    const draft = (
      await office
        .post(`/api/quotes/${request.id}/revisions`)
        .send({})
        .expect(201)
    ).body as OfficeQuote;
    const oven = draft.addOnChoices.find((a) => a.name === "Inside the oven")!;
    await office
      .patch(`/api/quotes/${draft.id}/draft`)
      .send({
        addOns: [oven.key],
        crewSize: 1,
        depositPercent: draft.draft!.depositPercent,
        validityDays: draft.draft!.validityDays,
        proposedStart: { date: "2026-01-08", time: "09:00" },
        overrides: {},
      })
      .expect(200);
    const sent = (await office.post(`/api/quotes/${draft.id}/send`).expect(200))
      .body as OfficeQuote;
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
      .send({ revisionId: sent.offer!.id, serviceKey: SEEDED.standard })
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
  test("leaves a Cleaner Needed and tells the Cleaner", async () => {
    const job = await thursdayJob();
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();
    await asCory
      .post(`/api/assignments/${assignmentId}/confirm`)
      .send({ startsAt: THURSDAY_9AM })
      .expect(200);

    const after = (
      await office
        .delete(`/api/jobs/${job.id}/assignments/${assignmentId}`)
        .expect(200)
    ).body as OfficeJob;

    // kept, so the Office sees it, and no longer open to them (#242)
    expect(after.assignments).toMatchObject([
      { staff: { id: cory.id }, status: "taken_off" },
    ]);
    expect(after.cleanersNeeded).toBe(2);
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
  test("are those they're on the crew of, today and to come, soonest first", async () => {
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
    // on Friday, as Cory is on another Job on Thursday morning
    const released = await bookedJob({
      startsAt: "2026-01-09T14:00:00Z",
      labourHours: 6,
      crewSize: 2,
    });
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
      serviceName: "Deep Clean",
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
      canRecordNoAccess: false,
      // a Job no Quote booked has nothing to report
      reportable: { quoted: [], others: [] },
      completion: null,
      noAccess: null,
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
    await asDee
      .post(`/api/assignments/${assignmentId}/confirm`)
      .send({ startsAt: THURSDAY_9AM })
      .expect(404);
    await asDee.post(`/api/assignments/${assignmentId}/release`).expect(404);
    expect(await ids(asDee)).toEqual({ today: [], upcoming: [] });
    // and from anyone who isn't a Cleaner
    await office.get("/api/assignments/mine").expect(403);
    await api().get("/api/assignments/mine").expect(401);
  });
});

describe("Confirming", () => {
  test("puts them on the crew, and a Job is assigned once its whole crew is Confirmed", async () => {
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    const job = await thursdayJob();
    const coryAssignment = await offered(office, job.id, cory.id);
    const deeAssignment = await offered(office, job.id, dee.id);
    const asCory = await cory.signIn();
    const asDee = await dee.signIn();
    testClock().advance({ hours: 1 });

    const seen = (
      await asCory
        .post(`/api/assignments/${coryAssignment}/confirm`)
        .send({ startsAt: THURSDAY_9AM })
        .expect(200)
    ).body as CleanerJob;

    expect(seen.assignment.status).toBe("confirmed");
    expect((await jobFor(office, job.id)).assignments[0]).toMatchObject({
      status: "confirmed",
      answeredAt: "2026-01-05T10:00:00.000Z",
    });
    expect((await jobFor(office, job.id)).assignment).toBe("unassigned");

    await asDee
      .post(`/api/assignments/${deeAssignment}/confirm`)
      .send({ startsAt: THURSDAY_9AM })
      .expect(200);
    // again changes nothing
    await asDee
      .post(`/api/assignments/${deeAssignment}/confirm`)
      .send({ startsAt: THURSDAY_9AM })
      .expect(200);

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
  test("leaves a Cleaner Needed and emails the Office", async () => {
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
    expect(after.cleanersNeeded).toBe(2);
    await asCory.get(`/api/assignments/mine/${job.id}`).expect(404);
    // and they can be Offered it again
    expect(after.cleaners.map((c) => c.id)).toEqual([cory.id]);
    await offer(office, job.id, cory.id).expect(201);

    const email = testEmail().lastTo("olive@example.com");
    expect(email.subject).toBe("Cory Cleaner released a Job");
    expect(email.text).toMatch(
      /Cory Cleaner has released this Job, so it needs a Cleaner:\n\nWhen: .*\nWhere: \d+ Austin St/,
    );
    expect(email.text).toContain(`http://localhost:5173/office/jobs/${job.id}`);
  });

  test("of an Offered Assignment is allowed right up to the Job", async () => {
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const job = await thursdayJob();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();
    testClock().set(new Date("2026-01-08T13:00:00Z"));

    expect((await myJob(asCory, job.id)).assignment.canRelease).toBe(true);
    await asCory.post(`/api/assignments/${assignmentId}/release`).expect(204);
  });

  test("of a Confirmed Assignment is refused within 48 hours of the Job", async () => {
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const job = await thursdayJob();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();
    await asCory
      .post(`/api/assignments/${assignmentId}/confirm`)
      .send({ startsAt: THURSDAY_9AM })
      .expect(200);

    // 48 hours to go: still allowed
    testClock().set(new Date("2026-01-06T14:00:00Z"));
    expect((await myJob(asCory, job.id)).assignment.canRelease).toBe(true);

    testClock().advance({ minutes: 1 });
    expect((await myJob(asCory, job.id)).assignment.canRelease).toBe(false);
    const refused = await asCory
      .post(`/api/assignments/${assignmentId}/release`)
      .expect(409);
    expect(refused.body.message).toBe(
      "A Confirmed Job can't be released within 48 hours of it. Please call the Office.",
    );
    expect((await myJob(asCory, job.id)).assignment.status).toBe("confirmed");
  });
});

describe("Unassigned Jobs in Needs attention", () => {
  test("are those within 48 hours whose crew isn't all Confirmed, soonest first", async () => {
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
    const assignmentId = await offered(office, covered.id, cory.id);
    const asCory = await cory.signIn();
    await asCory
      .post(`/api/assignments/${assignmentId}/confirm`)
      .send({ startsAt: covered.startsAt })
      .expect(200);
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

const openJobIds = async (agent: Agent) =>
  (
    (await agent.get("/api/assignments/open").expect(200))
      .body as CleanerNeeded[]
  ).map((p) => p.jobId);

const confirmAt = (agent: Agent, assignmentId: string, startsAt: string) =>
  agent.post(`/api/assignments/${assignmentId}/confirm`).send({ startsAt });

const statusOf = async (assignmentId: string) => {
  const [row] = await apart
    .select({ status: assignments.status })
    .from(assignments)
    .where(eq(assignments.id, assignmentId));
  return row!.status;
};

describe("Offering a Job to a Cleaner who isn't free (#242)", () => {
  test("is refused, as they could never Confirm it", async () => {
    const job = await thursdayJob(1);
    const other = await thursdayJob(1);
    const cory = await cleaner("Cory Cleaner");
    // no hours on Thursdays
    const fay = await createStaff({
      name: "Fay Cleaner",
      email: "fay@example.com",
      roles: ["cleaner"],
    });
    const office = await signInAsOffice();
    await offered(office, other.id, cory.id);

    const busy = await offer(office, job.id, cory.id).expect(409);
    const off = await offer(office, job.id, fay.id).expect(409);

    expect(busy.body.message).toBe(
      "Cory Cleaner isn't free then: they're on another Job or a Site Visit at that time, or have no hours that day",
    );
    expect(off.body.message).toMatch(/^Fay Cleaner isn't free then/);
  });
});

describe('Saying "Not for me" (#242)', () => {
  test("is only for a Cleaner the Job is open to", async () => {
    // one Cleaner still needed, open to anyone free but those on it
    const job = await thursdayJob(2);
    const cory = await cleaner("Cory Cleaner");
    // no hours that day
    await createStaff({
      name: "Fay Cleaner",
      email: "fay@example.com",
      roles: ["cleaner"],
    });
    const office = await signInAsOffice();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();
    await confirmAt(asCory, assignmentId, THURSDAY_9AM).expect(200);

    // Cory holds it, and Fay has no hours that day
    await asCory.post(`/api/assignments/open/${job.id}/pass`).expect(404);
    await (
      await signIn("fay@example.com")
    )
      .post(`/api/assignments/open/${job.id}/pass`)
      .expect(404);

    expect((await jobFor(office, job.id)).openTo.passedBy).toEqual([]);
  });
});

describe("Confirming an Offered Job (#242)", () => {
  test("is refused once the Cleaner is no longer free for it", async () => {
    const job = await thursdayJob(1);
    const cora = await cleaner("Cora Cleaner");
    const office = await signInAsOffice();
    const assignmentId = await offered(office, job.id, cora.id);
    const asCora = await cora.signIn();
    // a Site Visit of hers at 10am that day, booked however it was
    await apart.insert(siteVisits).values({
      propertyId: job.propertyId,
      staffId: cora.id,
      startsAt: new Date("2026-01-08T15:00:00Z"),
      minutes: 60,
      bookedAt: testClock().now(),
    });

    const refused = await confirmAt(asCora, assignmentId, THURSDAY_9AM).expect(
      409,
    );

    expect(refused.body.message).toBe(
      "You're no longer free for this Job. Please release it, or call the Office.",
    );
    expect(await statusOf(assignmentId)).toBe("offered");
  });

  test("is refused once the Job has started", async () => {
    const job = await thursdayJob(1);
    const cora = await cleaner("Cora Cleaner");
    const office = await signInAsOffice();
    const assignmentId = await offered(office, job.id, cora.id);
    testClock().set(new Date(THURSDAY_9AM));

    const refused = await confirmAt(
      await cora.signIn(),
      assignmentId,
      THURSDAY_9AM,
    ).expect(409);

    expect(refused.body.message).toBe(
      "This clean has already started, so you can't confirm it.",
    );
  });

  test("at a time the Job has moved from asks the Cleaner to look again", async () => {
    const job = await thursdayJob(1);
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    const assignmentId = await offered(office, job.id, dee.id);
    const asDee = await dee.signIn();
    await office
      .post(`/api/jobs/${job.id}/move`)
      .send({ date: "2026-01-07", time: "10:00" })
      .expect(200);

    const refused = await confirmAt(asDee, assignmentId, THURSDAY_9AM).expect(
      409,
    );

    expect(refused.body.message).toBe(
      "This Job has moved to Wednesday, January 7 at 10:00 AM. Please check the new time, then confirm again.",
    );
    expect(await statusOf(assignmentId)).toBe("offered");
    await confirmAt(asDee, assignmentId, "2026-01-07T15:00:00.000Z").expect(
      200,
    );
  });
});

describe("an Assignment to a Cancelled Job (#242)", () => {
  test("can't be Confirmed or Released from an old link", async () => {
    const job = await thursdayJob(1);
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();
    // cancelled meanwhile
    await apart
      .update(jobs)
      .set({
        status: "cancelled",
        cancelledAt: testClock().now(),
        cancelledBy: "empire",
      })
      .where(eq(jobs.id, job.id));
    const sent = testEmail().sent.length;

    await asCory.post(`/api/assignments/${assignmentId}/release`).expect(404);
    await confirmAt(asCory, assignmentId, THURSDAY_9AM).expect(404);

    expect(await statusOf(assignmentId)).toBe("offered");
    expect(testEmail().sent.slice(sent)).toEqual([]);
  });
});

describe("taking a Cleaner off a Job (#242)", () => {
  test("doesn't open the Job to them again", async () => {
    // 9am on Tuesday the 6th, within 48 hours: Cleaners Needed are emailed at once
    const job = await bookedJob({
      startsAt: "2026-01-06T14:00:00Z",
      labourHours: 3,
      crewSize: 1,
    });
    const cory = await cleaner("Cory Cleaner");
    const dee = await cleaner("Dee Cleaner");
    const office = await signInAsOffice();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();

    await office
      .delete(`/api/jobs/${job.id}/assignments/${assignmentId}`)
      .expect(200);

    expect(await openJobIds(asCory)).toEqual([]);
    expect(testEmail().lastTo(cory.email).subject).toBe(
      "You're no longer on a Job",
    );
    expect(testEmail().lastTo(dee.email).subject).toBe(
      "A Job soon is open to you",
    );
    await asCory
      .post(`/api/assignments/open/${job.id}/confirm`)
      .send({ startsAt: job.startsAt })
      .expect(409);
    // the Office can still Offer it to them
    await offer(office, job.id, cory.id).expect(201);
  });
});

describe("Releasing an Assignment while its Job is being moved (#242)", () => {
  test("waits for the move, so the Job it gave up isn't Offered back", async () => {
    const job = await thursdayJob(1);
    const cory = await cleaner("Cory Cleaner");
    const office = await signInAsOffice();
    const assignmentId = await offered(office, job.id, cory.id);
    const asCory = await cory.signIn();

    // a move holding the Job, as confirming a Reschedule Request does, that
    // Offers its crew the new time once Cory's Release has started
    let released: Promise<unknown> | undefined;
    await apart.transaction(async (tx) => {
      await tx.select().from(jobs).where(eq(jobs.id, job.id)).for("update");
      released = asCory
        .post(`/api/assignments/${assignmentId}/release`)
        .then((r) => r.status);
      await new Promise((settle) => setTimeout(settle, 300));
      await tx
        .update(assignments)
        .set({ status: "offered" })
        .where(eq(assignments.id, assignmentId));
    });

    expect(await released).toBe(204);
    expect(await statusOf(assignmentId)).toBe("released");
  });
});
