import { describe, expect, test } from "vitest";
import type {
  OfficeJob,
  OpenPlace,
  StaffDetail,
  StaffMember,
} from "@empire-cleaning/models";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import { createClient } from "#features/clients";
import { siteVisits } from "#features/site-visits";
import { createStaff, setUsualWeek } from "#features/staff";
import { api, signIn, testClock, testEmail } from "../../../tests/harness.ts";
import { bookedJob, signInAsOffice } from "../../../tests/fixtures.ts";
import { signInWithGoogle } from "../../../tests/google.ts";

type Office = Awaited<ReturnType<typeof signInAsOffice>>;

const cory = {
  name: "Cory Cleaner",
  email: "cory@example.com",
  roles: ["cleaner"],
};

const invite = (office: Office, invitation: object = cory) =>
  office.post("/api/staff").send(invitation);

const me = async (agent: Office) =>
  (await agent.get("/api/me").expect(200)).body;

const staffNamed = async (office: Office, name: string) =>
  ((await office.get("/api/staff").expect(200)).body as StaffMember[]).find(
    (m) => m.name === name,
  )!;

// What deactivating a Cleaner, or a day of theirs going to 0 hours, does to
// what they hold (#242, #158). Cory holds a Confirmed place on a Job at 9am on
// Thursday the 8th, a crew of one; Dee, free that day, could take it.
const corysThursday = async () => {
  const office = await signInAsOffice();
  const { id: officeId } = await me(office);
  const member = await createStaff({ ...cory, roles: ["cleaner"] });
  await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
  const dee = await createStaff({
    name: "Dee Cleaner",
    email: "dee@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(dee.id, [8, 8, 8, 8, 8, 0, 0]);
  const job = await bookedJob({
    startsAt: "2026-01-08T14:00:00Z",
    labourHours: 3,
    crewSize: 1,
  });
  const offered = await offerAssignment(job.id, member.id, officeId);
  await confirmAssignment(member.id, offered.assignments[0]!.id);
  const path = `/api/staff/${member.id}`;
  const jobOf = async () =>
    (await office.get(`/api/jobs/${job.id}`).expect(200)).body as OfficeJob;
  const openToDee = async () =>
    (
      (await (await signIn("dee@example.com")).get("/api/assignments/open"))
        .body as OpenPlace[]
    ).map((p) => p.jobId);
  return { office, member, job, path, jobOf, openToDee };
};

// a booked Site Visit by a Staff member at a Property
const siteVisitBy = async (
  staffId: string,
  propertyId: string,
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

describe("inviting Staff", () => {
  test("is only for Office Staff", async () => {
    await api().get("/api/staff").expect(401);
    await api().post("/api/staff").send(cory).expect(401);

    await createStaff({ ...cory, roles: ["cleaner"] });
    const cleaner = await signIn(cory.email);
    await cleaner.get("/api/staff").expect(403);
    await invite(cleaner, { ...cory, email: "x@example.com" }).expect(403);
  });

  test("creates a Staff member, not an Account, and emails them a way to sign up", async () => {
    const office = await signInAsOffice();

    const { body } = await invite(office).expect(201);

    expect(body).toMatchObject({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
      active: true,
      signedUp: false,
    });
    const invitation = testEmail().lastTo("cory@example.com");
    expect(invitation.subject).toBe("You're invited to join Empire Cleaning");
    expect(invitation.text).toContain("/sign-in");
    expect(invitation.text).toContain("cory@example.com");
    // replies reach the Office, not the no-reply sender
    expect(invitation.replyTo).toBe("office@example.com");
  });

  test("signing up with the invited email connects them, with the roles given", async () => {
    const office = await signInAsOffice();
    await invite(office, {
      name: "Bo Both",
      email: "Bo@Example.com",
      roles: ["cleaner", "office_staff"],
    }).expect(201);

    const bo = await signIn("bo@example.com");

    expect((await me(bo)).roles.sort()).toEqual(["cleaner", "office_staff"]);
    expect((await staffNamed(office, "Bo Both")).signedUp).toBe(true);
  });

  test("someone who signed up already is connected straight away", async () => {
    const office = await signInAsOffice();
    const coryAgent = await signIn(cory.email);

    await invite(office).expect(201);

    expect((await me(coryAgent)).roles).toEqual(["cleaner"]);
  });

  test("the invitation email itself signs nobody in", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);

    const link = new URL(
      testEmail()
        .lastTo(cory.email)
        .text.match(/https?:\/\/\S+/)![0],
    );

    expect(link.pathname).toBe("/sign-in");
    expect(link.search).toBe("");
  });

  test("needs a name, an email and at least one role", async () => {
    const office = await signInAsOffice();

    const { body } = await invite(office, {
      name: " ",
      email: "not-an-email",
      roles: [],
    }).expect(400);

    expect(body.details.map((d: { path: string }) => d.path).sort()).toEqual([
      "email",
      "name",
      "roles",
    ]);
    await invite(office, { ...cory, roles: ["owner"] }).expect(400);
  });

  test("won't invite someone already on Staff", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);

    const { body } = await invite(office, {
      ...cory,
      email: "CORY@example.com",
    }).expect(409);

    expect(body.message).toBe("Cory Cleaner is already on Staff");
  });

  test("still invites them when the email can't be sent", async () => {
    const office = await signInAsOffice();
    testEmail().failSending();

    await invite(office).expect(201);

    expect((await staffNamed(office, "Cory Cleaner")).active).toBe(true);
  });
});

describe("Staff pictures", () => {
  const picture = "https://lh3.googleusercontent.com/a/cory-photo";

  test("are their Google profile picture once they sign in with Google", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);
    expect((await staffNamed(office, "Cory Cleaner")).imageUrl).toBeNull();

    await signInWithGoogle({ sub: "1001", email: cory.email, picture });

    const member = await staffNamed(office, "Cory Cleaner");
    expect(member.imageUrl).toBe(picture);
    expect((await office.get(`/api/staff/${member.id}`)).body.imageUrl).toBe(
      picture,
    );
  });

  test("appear when someone who signed up by emailed link later uses Google", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);
    await signIn(cory.email);
    expect((await staffNamed(office, "Cory Cleaner")).imageUrl).toBeNull();

    await signInWithGoogle({ sub: "1001", email: cory.email, picture });

    expect((await staffNamed(office, "Cory Cleaner")).imageUrl).toBe(picture);
  });

  test("follow a changed Google picture at the next sign-in", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);
    await signInWithGoogle({ sub: "1001", email: cory.email, picture });

    await signInWithGoogle({
      sub: "1001",
      email: cory.email,
      picture: `${picture}-new`,
    });

    expect((await staffNamed(office, "Cory Cleaner")).imageUrl).toBe(
      `${picture}-new`,
    );
  });
});

describe("editing Staff", () => {
  const edit = (office: Office, id: string, changes: object) =>
    office.patch(`/api/staff/${id}`).send(changes);

  test("changes their name and roles, and their access with them", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);
    const coryAgent = await signIn(cory.email);
    const member = await staffNamed(office, "Cory Cleaner");

    const { body } = await edit(office, member.id, {
      name: "Cory Clean",
      roles: ["cleaner", "office_staff"],
    }).expect(200);

    expect(body).toMatchObject({
      name: "Cory Clean",
      roles: ["cleaner", "office_staff"],
    });
    expect((await me(coryAgent)).roles.sort()).toEqual([
      "cleaner",
      "office_staff",
    ]);
  });

  test("is only for Office Staff", async () => {
    await createStaff({ ...cory, roles: ["cleaner"] });
    const cleaner = await signIn(cory.email);
    const office = await signInAsOffice();
    const member = await staffNamed(office, "Cory Cleaner");

    await edit(cleaner, member.id, { name: "Me", roles: ["cleaner"] }).expect(
      403,
    );
  });

  test("needs a name and at least one role", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);
    const member = await staffNamed(office, "Cory Cleaner");

    const { body } = await edit(office, member.id, {
      name: " ",
      roles: [],
    }).expect(400);

    expect(
      body.details.map((d: { path: string; issue: string }) => [
        d.path,
        d.issue,
      ]),
    ).toEqual([
      ["name", "Enter their name"],
      ["roles", "Choose at least one role"],
    ]);
  });

  test("won't leave the business without an active Office Staff member", async () => {
    const office = await signInAsOffice();
    const olive = await staffNamed(office, "Olive Owner");

    const { body } = await edit(office, olive.id, {
      name: "Olive Owner",
      roles: ["cleaner"],
    }).expect(409);

    expect(body.message).toBe(
      "Empire Cleaning needs at least one active Office Staff member",
    );
  });

  test("won't take the Cleaner role from someone holding a place on a Job to come", async () => {
    const office = await signInAsOffice();
    const member = await createStaff({ ...cory, roles: ["cleaner"] });
    await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
    const job = await bookedJob({
      startsAt: "2026-01-08T14:00:00Z",
      labourHours: 4,
    });
    await office
      .post(`/api/jobs/${job.id}/assignments`)
      .send({ staffId: member.id })
      .expect(201);

    const { body } = await edit(office, member.id, {
      name: "Cory Cleaner",
      roles: ["office_staff"],
    }).expect(409);

    expect(body.message).toBe(
      "Cory Cleaner holds a place on a Job to come: release it first",
    );
  });
});

describe("deactivating Staff", () => {
  test("ends their Staff access at once, and leaves their Client access", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);
    await createClient({
      name: "Cory Cleaner",
      email: cory.email,
      phone: "(646) 555-0101",
    });
    const coryAgent = await signIn(cory.email);
    expect((await me(coryAgent)).roles.sort()).toEqual(["cleaner", "client"]);

    const member = await staffNamed(office, "Cory Cleaner");
    const { body } = await office
      .post(`/api/staff/${member.id}/deactivate`)
      .expect(200);

    expect(body.active).toBe(false);
    expect((await me(coryAgent)).roles).toEqual(["client"]);
  });

  test("keeps them on the list, after the active Staff", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);
    const member = await staffNamed(office, "Cory Cleaner");
    await office.post(`/api/staff/${member.id}/deactivate`).expect(200);

    const list = (await office.get("/api/staff")).body as StaffMember[];

    expect(list.map((m) => [m.name, m.active])).toEqual([
      ["Olive Owner", true],
      ["Cory Cleaner", false],
    ]);
  });

  test("inviting them again brings them back, with the roles given now", async () => {
    const office = await signInAsOffice();
    await invite(office).expect(201);
    const coryAgent = await signIn(cory.email);
    const member = await staffNamed(office, "Cory Cleaner");
    await office.post(`/api/staff/${member.id}/deactivate`).expect(200);

    const { body } = await invite(office, {
      ...cory,
      roles: ["cleaner", "office_staff"],
    }).expect(201);

    expect(body).toMatchObject({ id: member.id, active: true });
    expect((await me(coryAgent)).roles.sort()).toEqual([
      "cleaner",
      "office_staff",
    ]);
  });

  test("won't leave the business without an active Office Staff member", async () => {
    const office = await signInAsOffice();
    const olive = await staffNamed(office, "Olive Owner");

    const { body } = await office
      .post(`/api/staff/${olive.id}/deactivate`)
      .expect(409);

    expect(body.message).toBe(
      "Empire Cleaning needs at least one active Office Staff member",
    );
    expect((await me(office)).roles).toEqual(["office_staff"]);
  });

  test("is not found for someone who isn't on Staff", async () => {
    const office = await signInAsOffice();

    await office
      .post("/api/staff/00000000-0000-4000-8000-000000000000/deactivate")
      .expect(404);
  });

  test("Releases their places on Jobs to come, opening them to everyone free (#242)", async () => {
    const { office, member, jobOf, openToDee } = await corysThursday();

    await office.post(`/api/staff/${member.id}/deactivate`).expect(200);

    expect(await jobOf()).toMatchObject({
      assignment: "unassigned",
      openPlaces: 1,
      assignments: [{ status: "released" }],
    });
    expect(await openToDee()).toHaveLength(1);
  });

  test("waits for a Site Visit of theirs to go to someone else (#242)", async () => {
    const { office, member, job, jobOf } = await corysThursday();
    await siteVisitBy(member.id, job.propertyId, "2026-01-09T15:00:00Z");

    const { body } = await office
      .post(`/api/staff/${member.id}/deactivate`)
      .expect(409);

    expect(body.message).toMatch(
      /^Cory has a Site Visit at \d+ Austin St, 4B, 11375 on Friday, January 9 at 10:00 AM\. Give it to someone else first\.$/,
    );
    expect((await office.get(`/api/staff/${member.id}`)).body.active).toBe(
      true,
    );
    expect((await jobOf()).assignment).toBe("assigned");
  });
});

describe("Staff availability", () => {
  const corysDetail = async (office: Office) => {
    await invite(office).expect(201);
    const member = await staffNamed(office, "Cory Cleaner");
    return { id: member.id, path: `/api/staff/${member.id}` };
  };

  test("starts at no hours on any day", async () => {
    const office = await signInAsOffice();
    const { path } = await corysDetail(office);

    const { body } = await office.get(path).expect(200);

    expect((body as StaffDetail).availability).toEqual({
      usualWeek: [0, 0, 0, 0, 0, 0, 0],
      exceptions: [],
    });
  });

  test("records a usual week, Monday first", async () => {
    const office = await signInAsOffice();
    const { path } = await corysDetail(office);

    await office
      .put(`${path}/usual-week`)
      .send({ usualWeek: [8, 8, 7.5, 8, 6.25, 0, 0] })
      .expect(200);

    const { body } = await office.get(path);
    expect(body.availability.usualWeek).toEqual([8, 8, 7.5, 8, 6.25, 0, 0]);
  });

  test("records days that differ from the usual week, and can remove them", async () => {
    const office = await signInAsOffice();
    const { path } = await corysDetail(office);

    await office
      .put(`${path}/exceptions/2026-01-09`)
      .send({ hours: 0, note: "Holiday" })
      .expect(200);
    await office
      .put(`${path}/exceptions/2026-01-07`)
      .send({ hours: 4 })
      .expect(200);
    // setting a day again replaces it
    await office
      .put(`${path}/exceptions/2026-01-07`)
      .send({ hours: 5, note: "Extra" })
      .expect(200);

    let detail = (await office.get(path)).body as StaffDetail;
    expect(detail.availability.exceptions).toEqual([
      { date: "2026-01-07", hours: 5, note: "Extra" },
      { date: "2026-01-09", hours: 0, note: "Holiday" },
    ]);

    await office.delete(`${path}/exceptions/2026-01-07`).expect(200);
    detail = (await office.get(path)).body as StaffDetail;
    expect(detail.availability.exceptions.map((e) => e.date)).toEqual([
      "2026-01-09",
    ]);
  });

  test("lists exceptions from today on, in New York", async () => {
    const office = await signInAsOffice();
    const { path } = await corysDetail(office);
    await office.put(`${path}/exceptions/2026-01-04`).send({ hours: 2 });
    await office.put(`${path}/exceptions/2026-01-05`).send({ hours: 3 });
    // 2am on the 6th in London is still the 5th in New York
    testClock().set(new Date("2026-01-06T02:00:00Z"));

    const { body } = await office.get(path);

    expect(
      body.availability.exceptions.map((e: { date: string }) => e.date),
    ).toEqual(["2026-01-05"]);
  });

  test("explains what's wrong with the hours given", async () => {
    const office = await signInAsOffice();
    const { path } = await corysDetail(office);

    const week = await office
      .put(`${path}/usual-week`)
      .send({ usualWeek: [8, 8, 8, 8, 25, -1, 7.1] })
      .expect(400);
    expect(
      week.body.details.map((d: { path: string; issue: string }) => [
        d.path,
        d.issue,
      ]),
    ).toEqual([
      ["usualWeek.4", "That's more than a day"],
      ["usualWeek.5", "Hours can't be negative"],
      ["usualWeek.6", "Use quarter-hours, like 7.5 or 7.25"],
    ]);
    await office
      .put(`${path}/usual-week`)
      .send({ usualWeek: [8, 8] })
      .expect(400);
    await office
      .put(`${path}/exceptions/2026-02-30`)
      .send({ hours: 2 })
      .expect(400);
  });

  test("shows what they hold from now on, soonest first", async () => {
    const { office, member, job, path } = await corysThursday();
    await siteVisitBy(member.id, job.propertyId, "2026-01-07T15:00:00Z");

    const { body } = await office.get(path).expect(200);

    expect((body as StaffDetail).holding).toEqual([
      {
        kind: "site_visit",
        id: expect.any(String),
        startsAt: "2026-01-07T15:00:00.000Z",
        what: "Site Visit",
        where: expect.stringMatching(/Austin St/),
      },
      {
        kind: "job",
        id: job.id,
        startsAt: "2026-01-08T14:00:00.000Z",
        what: "Deep Clean",
        where: expect.stringMatching(/Austin St/),
      },
    ]);
  });

  test("a day going to 0 hours frees their places that day, and tells them (#158, #242)", async () => {
    const { office, path, jobOf, openToDee } = await corysThursday();

    await office
      .put(`${path}/exceptions/2026-01-08`)
      .send({ hours: 0, note: "Sick" })
      .expect(200);

    expect(await jobOf()).toMatchObject({
      assignment: "unassigned",
      openPlaces: 1,
    });
    expect(await openToDee()).toHaveLength(1);
    expect(testEmail().lastTo(cory.email).subject).toBe(
      "You're no longer on a Job",
    );
  });

  test("fewer hours that aren't 0 keep their places", async () => {
    const { office, path, jobOf } = await corysThursday();

    await office
      .put(`${path}/exceptions/2026-01-08`)
      .send({ hours: 2 })
      .expect(200);

    expect((await jobOf()).assignment).toBe("assigned");
  });

  test("a weekday going to 0 in the usual week frees their places on it (#158, #242)", async () => {
    const { office, path, jobOf } = await corysThursday();

    await office
      .put(`${path}/usual-week`)
      .send({ usualWeek: [8, 8, 8, 0, 8, 0, 0] })
      .expect(200);

    expect((await jobOf()).assignment).toBe("unassigned");
  });

  test("a day going back to a usual week of 0 frees their places that day", async () => {
    const { office, path, jobOf } = await corysThursday();
    await office
      .put(`${path}/exceptions/2026-01-08`)
      .send({ hours: 8 })
      .expect(200);
    await office
      .put(`${path}/usual-week`)
      .send({ usualWeek: [8, 8, 8, 0, 8, 0, 0] })
      .expect(200);
    expect((await jobOf()).assignment).toBe("assigned");

    await office.delete(`${path}/exceptions/2026-01-08`).expect(200);

    expect((await jobOf()).assignment).toBe("unassigned");
  });

  test("a day off over a Site Visit waits for it to go to someone else (#242)", async () => {
    const { office, member, job, path, jobOf } = await corysThursday();
    await siteVisitBy(member.id, job.propertyId, "2026-01-08T19:00:00Z");

    const { body } = await office
      .put(`${path}/exceptions/2026-01-08`)
      .send({ hours: 0 })
      .expect(409);

    expect(body.message).toMatch(
      /^Cory has a Site Visit at \d+ Austin St, 4B, 11375 on Thursday, January 8 at 2:00 PM\. Give it to someone else first\.$/,
    );
    expect(
      ((await office.get(path)).body as StaffDetail).availability.exceptions,
    ).toEqual([]);
    expect((await jobOf()).assignment).toBe("assigned");
  });

  test("is only for Office Staff", async () => {
    const office = await signInAsOffice();
    const { path } = await corysDetail(office);
    const coryAgent = await signIn(cory.email);

    await coryAgent.get(path).expect(403);
    await coryAgent
      .put(`${path}/usual-week`)
      .send({ usualWeek: [24, 24, 24, 24, 24, 24, 24] })
      .expect(403);
    await api()
      .put(`${path}/exceptions/2026-01-09`)
      .send({ hours: 9 })
      .expect(401);
  });
});
