import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  ClientList,
  ClientListItem,
  ClientStanding,
} from "@empire-cleaning/models";
import { db } from "#db";
import { clients, createClient } from "#features/clients";
import { jobs, type Job } from "#features/jobs";
import { properties } from "#features/properties";
import { quotes } from "#features/quotes";
import { servicePlans } from "#features/service-plans";
import { createStaff } from "#features/staff";
import {
  type Agent,
  api,
  apiAgent,
  limitedAs,
  signIn,
  testClock,
  testEmail,
} from "../../../tests/harness.ts";
import { signInWithGoogle } from "../../../tests/google.ts";
import {
  bookedJob,
  casey,
  crewedServicePlan,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";

const sam = {
  name: "sam Seed",
  email: "sam@example.com",
  phone: "718-555-0199",
};

// Casey with two homes, and Sam with one at 1 Nudge Lane
const twoClients = async () => {
  await submit(guestAsk()).expect(201);
  await submit(
    guestAsk({
      property: { new: { ...home, street: "35-06 Ditmars Blvd", unit: null } },
    }),
  ).expect(201);
  await submit(
    guestAsk({
      contact: sam,
      property: { new: { ...home, street: "1 Nudge Lane", unit: null } },
    }),
  ).expect(201);
};

const search = async (office: Agent, q?: string) =>
  (
    (await office.get("/api/clients").query(q === undefined ? {} : { q })).body
      .clients as ClientListItem[]
  ).map((c) => c.name);

describe("the Office's list of Clients", () => {
  test("is only for Office Staff", async () => {
    await api().get("/api/clients").expect(401);

    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    await client.get("/api/clients").expect(403);

    await createStaff({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
    });
    await (await signIn("cory@example.com")).get("/api/clients").expect(403);
  });

  test("lists every Client in name order, with their contact details", async () => {
    await twoClients();
    const office = await signInAsOffice();

    const { body } = await office.get("/api/clients").expect(200);

    expect(body).toEqual({
      clients: [
        {
          id: expect.any(String),
          name: "Casey Client",
          businessName: null,
          email: "casey@example.com",
          phone: "(646) 555-0100",
          imageUrl: null,
          standing: "quoting",
        },
        {
          id: expect.any(String),
          name: "sam Seed",
          businessName: null,
          email: "sam@example.com",
          phone: "718-555-0199",
          imageUrl: null,
          standing: "quoting",
        },
      ],
      counts: { active: 0, quoting: 2, past: 0, all: 2 },
    });
  });

  test("finds Clients by part of their name, email or Property address, ignoring case", async () => {
    await twoClients();
    const office = await signInAsOffice();

    expect(await search(office, "SEED")).toEqual(["sam Seed"]);
    expect(await search(office, "casey@")).toEqual(["Casey Client"]);
    expect(await search(office, "nud")).toEqual(["sam Seed"]);
    expect(await search(office, "ditmars")).toEqual(["Casey Client"]);
    // the address as it's shown
    expect(await search(office, "Austin St, 4B")).toEqual(["Casey Client"]);
    expect(await search(office, "11375")).toEqual(["Casey Client", "sam Seed"]);
    expect(await search(office, "  ")).toEqual(["Casey Client", "sam Seed"]);
    expect(await search(office, "nobody")).toEqual([]);
  });

  test("finds Clients by phone on its digits alone", async () => {
    await twoClients();
    const office = await signInAsOffice();

    expect(await search(office, "(718) 555")).toEqual(["sam Seed"]);
    expect(await search(office, "718555")).toEqual(["sam Seed"]);
    expect(await search(office, "646-555-0100")).toEqual(["Casey Client"]);
  });

  test("takes % and _ in a search as themselves", async () => {
    await twoClients();
    const office = await signInAsOffice();

    expect(await search(office, "%")).toEqual([]);
    expect(await search(office, "_")).toEqual([]);
  });

  test("shows a Client's Google picture once they sign in with Google", async () => {
    await twoClients();
    const office = await signInAsOffice();
    const picture = "https://lh3.googleusercontent.com/a/casey-photo";

    await signInWithGoogle({ sub: "2001", email: casey.email, picture });

    const { body } = await office.get("/api/clients").expect(200);
    expect(
      (body as ClientList).clients.map((c) => [c.name, c.imageUrl]),
    ).toEqual([
      ["Casey Client", picture],
      ["sam Seed", null],
    ]);
  });
});

// each Client's standing, by name
const standings = async (office: Agent) =>
  Object.fromEntries(
    (
      (await office.get("/api/clients").expect(200)).body as ClientList
    ).clients.map((c) => [c.name, c.standing]),
  ) as Record<string, ClientStanding>;

// the name of the Client whose home a Job is at
const clientOf = async (job: Job) => {
  const [found] = await db
    .select({ name: clients.name })
    .from(properties)
    .innerJoin(clients, eq(clients.id, properties.clientId))
    .where(eq(properties.id, job.propertyId));
  return found!.name;
};

describe("where Clients stand", () => {
  test("Active with a Job coming up or in the last 90 days; not with one older or cancelled", async () => {
    testClock().set(new Date("2026-03-02T12:00:00Z"));
    const upcoming = await clientOf(
      await bookedJob({ startsAt: "2026-03-10T14:00:00Z", labourHours: 2 }),
    );
    const recent = await clientOf(
      await bookedJob({ startsAt: "2026-01-05T14:00:00Z", labourHours: 2 }),
    );
    const old = await clientOf(
      await bookedJob({ startsAt: "2025-11-01T14:00:00Z", labourHours: 2 }),
    );
    const cancelledJob = await bookedJob({
      startsAt: "2026-03-11T14:00:00Z",
      labourHours: 2,
    });
    await db
      .update(jobs)
      .set({ status: "cancelled" })
      .where(eq(jobs.id, cancelledJob.id));
    const cancelled = await clientOf(cancelledJob);

    expect(await standings(await signInAsOffice())).toMatchObject({
      [upcoming]: "active",
      [recent]: "active",
      [old]: "past",
      [cancelled]: "past",
    });
  });

  test("Active with a Service Plan, On Hold too, long after its last Job; Past once it ends", async () => {
    await crewedServicePlan();
    // signed in as the Office already
    const office = await signIn("olive@example.com");
    testClock().set(new Date("2027-06-01T12:00:00Z"));
    expect((await standings(office))[casey.name]).toBe("active");

    await db.update(servicePlans).set({ status: "on_hold" });
    expect((await standings(office))[casey.name]).toBe("active");

    await db
      .update(servicePlans)
      .set({ status: "ended", endedAt: testClock().now() });
    expect((await standings(office))[casey.name]).toBe("past");
  });

  test("Quoting while a Quote is open; Past once it's closed", async () => {
    await submit(guestAsk()).expect(201);
    const office = await signInAsOffice();
    expect((await standings(office))[casey.name]).toBe("quoting");

    const [quote] = await db.select({ id: quotes.id }).from(quotes);
    await office
      .post(`/api/quotes/${quote!.id}/turn-down`)
      .send({ reason: "out_of_area" })
      .expect(200);
    expect((await standings(office))[casey.name]).toBe("past");
  });
});

describe("pages of the list", () => {
  test("hold one standing, with how many match the search in each", async () => {
    await twoClients();
    testClock().set(new Date("2026-03-02T12:00:00Z"));
    const active = await clientOf(
      await bookedJob({ startsAt: "2026-03-10T14:00:00Z", labourHours: 2 }),
    );
    const office = await signInAsOffice();

    const all = (await office.get("/api/clients").expect(200))
      .body as ClientList;
    expect(all.counts).toEqual({ active: 1, quoting: 2, past: 0, all: 3 });

    const onlyActive = (
      await office.get("/api/clients?standing=active").expect(200)
    ).body as ClientList;
    expect(onlyActive.clients.map((c) => c.name)).toEqual([active]);
    expect(onlyActive.counts).toEqual(all.counts);

    const searched = (await office.get("/api/clients?q=seed").expect(200))
      .body as ClientList;
    expect(searched.counts).toEqual({ active: 0, quoting: 1, past: 0, all: 1 });
  });

  test("hold the first 50 Clients unless more are asked for", async () => {
    for (let i = 0; i < 52; i += 1) {
      await createClient({
        name: `Client ${String(i).padStart(2, "0")}`,
        email: `client${i}@example.com`,
        phone: casey.phone,
      });
    }
    const office = await signInAsOffice();

    const first = (await office.get("/api/clients").expect(200))
      .body as ClientList;
    expect(first.clients).toHaveLength(50);
    expect(first.clients.at(-1)!.name).toBe("Client 49");
    expect(first.counts.all).toBe(52);

    const more = (await office.get("/api/clients?limit=100").expect(200))
      .body as ClientList;
    expect(more.clients).toHaveLength(52);
  });

  test("refuse a standing or a limit that isn't one", async () => {
    const office = await signInAsOffice();
    await office.get("/api/clients?standing=gone").expect(400);
    await office.get("/api/clients?limit=0").expect(400);
  });
});

// a Client's new email is theirs once they open the link sent to it, so no
// one can claim an address they don't own, nor the asks made from it (#243)
describe("a Client changing their email", () => {
  const dana = "dana@example.com";

  const asCasey = async () => {
    await submit(guestAsk()).expect(201);
    return signIn(casey.email);
  };

  const changeEmail = (agent: ReturnType<typeof apiAgent>, email: string) =>
    agent.patch("/api/clients/me").send({ ...casey, email });

  // the token in the latest confirmation link sent to `address`
  const tokenSentTo = (address: string) => {
    const { text } = testEmail().lastTo(address);
    const link = text.match(/https?:\/\/\S+\/confirm-email\?token=\S+/);
    if (!link)
      throw new Error(`no confirmation link in the email to ${address}`);
    return new URL(link[0]).searchParams.get("token")!;
  };

  const confirm = (token: string) =>
    api().post("/api/clients/email-changes/confirm").send({ token });

  test("keeps the old email until the link sent to the new one is opened", async () => {
    const agent = await asCasey();

    const res = await changeEmail(agent, "Casey@Work.example.com").expect(200);

    expect(res.body).toMatchObject({
      email: casey.email,
      pendingEmail: "casey@work.example.com",
    });
    expect(testEmail().lastTo("casey@work.example.com").subject).toBe(
      "Confirm your new email",
    );
  });

  test("opening the link makes it theirs, signed in or not", async () => {
    const agent = await asCasey();
    await changeEmail(agent, "casey@work.example.com").expect(200);

    const res = await confirm(tokenSentTo("casey@work.example.com"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: "casey@work.example.com" });
    const me = (await agent.get("/api/clients/me").expect(200)).body;
    expect(me).toMatchObject({
      email: "casey@work.example.com",
      pendingEmail: null,
    });
    // still connected after the email change (ADR-0006)
    expect((await agent.get("/api/me")).body.roles).toEqual(["client"]);
  });

  test("a waiting email doesn't take a Guest's ask from that address", async () => {
    const agent = await asCasey();
    await changeEmail(agent, dana).expect(200);

    await submit(
      guestAsk({
        contact: { ...casey, name: "Dana", email: dana },
        property: { new: { ...home, street: "1 Dana Lane", unit: null } },
      }),
    ).expect(201);

    const mine = (await agent.get("/api/clients/me").expect(200)).body;
    expect(mine.properties).toHaveLength(1);
    expect(mine.quotes).toHaveLength(1);
    const danas = (await (await signIn(dana)).get("/api/clients/me")).body;
    expect(danas.properties.map((p: { street: string }) => p.street)).toEqual([
      "1 Dana Lane",
    ]);
  });

  test("a waiting email doesn't take the ask of an Account signed in with it", async () => {
    const agent = await asCasey();
    await changeEmail(agent, dana).expect(200);
    const danasAccount = await signIn(dana);

    await submit(
      guestAsk({
        contact: { ...casey, name: "Dana", email: dana },
        property: { new: { ...home, street: "1 Dana Lane", unit: null } },
      }),
      danasAccount,
    ).expect(201);

    const danas = (await danasAccount.get("/api/clients/me").expect(200)).body;
    expect(danas).toMatchObject({ email: dana, pendingEmail: null });
    expect(danas.quotes).toHaveLength(1);
    const mine = (await agent.get("/api/clients/me").expect(200)).body;
    expect(mine.quotes).toHaveLength(1);
  });

  test("a link works once, and only for a day", async () => {
    const agent = await asCasey();
    await changeEmail(agent, "casey@work.example.com").expect(200);
    const used = tokenSentTo("casey@work.example.com");
    await confirm(used).expect(200);
    await changeEmail(agent, "casey@home.example.com").expect(200);
    const stale = tokenSentTo("casey@home.example.com");

    testClock().advance({ hours: 24, minutes: 1 });

    for (const token of [used, stale, "not-a-token"]) {
      const res = await confirm(token);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe(
        "This link has expired or was used already.",
      );
    }
    expect((await agent.get("/api/clients/me")).body.email).toBe(
      "casey@work.example.com",
    );
  });

  test("can't be confirmed once another Client has the email", async () => {
    const agent = await asCasey();
    await changeEmail(agent, dana).expect(200);
    const token = tokenSentTo(dana);
    await submit(
      guestAsk({
        contact: { ...casey, name: "Dana", email: dana },
        property: { new: { ...home, street: "1 Dana Lane", unit: null } },
      }),
    ).expect(201);

    const res = await confirm(token);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "That email is already used by another Client",
    );
    expect((await agent.get("/api/clients/me")).body.email).toBe(casey.email);
  });

  test("giving their own email back drops the waiting change", async () => {
    const agent = await asCasey();
    await changeEmail(agent, "casey@work.example.com").expect(200);
    const token = tokenSentTo("casey@work.example.com");

    const res = await changeEmail(agent, casey.email).expect(200);

    expect(res.body).toMatchObject({ email: casey.email, pendingEmail: null });
    await confirm(token).expect(404);
  });

  test("a new address gets six links a day, so no inbox is flooded", async () => {
    limitedAs("prod");
    const agent = await asCasey();
    for (let i = 0; i < 6; i++) {
      await changeEmail(agent, dana).expect(200);
      await changeEmail(agent, casey.email).expect(200);
    }

    const refused = await changeEmail(agent, dana);

    expect(refused.status).toBe(429);
    expect(testEmail().to(dana)).toHaveLength(6);
  });

  test("the whole site sends 20 links an hour, whoever they're to", async () => {
    // anyone can become a Client by asking for a Quote (#243)
    limitedAs("prod");
    const agent = await asCasey();
    for (let i = 0; i < 20; i++) {
      await changeEmail(agent, `person${i}@example.com`).expect(200);
    }

    const refused = await changeEmail(agent, dana);

    expect(refused.status).toBe(429);
    expect(testEmail().to(dana)).toHaveLength(0);
  });
});

describe("making a Client", () => {
  test("for someone signed up already, it comes back connected", async () => {
    const account = (await (await signIn(sam.email)).get("/api/me")).body as {
      id: string;
    };

    const client = await createClient(sam);

    expect(client.accountId).toBe(account.id);
  });
});
