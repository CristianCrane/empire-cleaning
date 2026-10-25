import { describe, expect, test } from "vitest";
import type { StaffDetail, StaffMember } from "@empire-cleaning/models";
import { createClient } from "#features/clients";
import { createStaff } from "#features/staff";
import { api, signIn, testClock, testEmail } from "../../../tests/harness.ts";
import { signInAsOffice } from "../../../tests/fixtures.ts";
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
