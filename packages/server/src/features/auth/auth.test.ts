import { describe, expect, test, vi } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "#middleware";
import { authorize, signedInAccount } from "#features/auth";
import { changeClientEmail, createClient } from "#features/clients";
import { createStaff, deactivateStaff } from "#features/staff";
import env from "../../env.ts";
import { createOwner } from "./create-owner.ts";
import {
  api,
  apiAgent,
  signIn,
  emailedLinkFor,
  signInButtonFor,
  testEmail,
} from "../../../tests/harness.ts";
import { signInWithGoogle } from "../../../tests/google.ts";

const me = async (agent: ReturnType<typeof apiAgent>) =>
  (await agent.get("/api/me").expect(200)).body;

describe("signing up and in with an emailed link", () => {
  test("a new email signs up, and its Account starts connected to nothing", async () => {
    const agent = await signIn("new@example.com");

    expect(testEmail().lastTo("new@example.com").subject).toBe(
      "Sign in to Empire Cleaning",
    );
    expect(await me(agent)).toMatchObject({
      email: "new@example.com",
      roles: [],
    });
  });

  test("signing in again uses the same Account", async () => {
    const first = await me(await signIn("casey@example.com"));
    const again = await me(await signIn("casey@example.com"));

    expect(again.id).toBe(first.id);
  });

  test("a link signs in only once", async () => {
    await signIn("casey@example.com");
    const second = apiAgent();
    await second.get(signInButtonFor("casey@example.com"));

    expect((await second.get("/api/me")).status).toBe(401);
  });

  // mail scanners open links before the person does (#243): the link opens
  // the app's page, and only its Sign in button uses the token
  test("the emailed link opens the app's page, not the API", async () => {
    await api()
      .post("/api/auth/sign-in/magic-link")
      .send({ email: "casey@example.com", callbackURL: "/" })
      .expect(200);

    const link = emailedLinkFor("casey@example.com");

    expect(`${link.origin}${link.pathname}`).toBe(
      `${env.CORS_ORIGIN_URL}/sign-in/link`,
    );
    expect(link.searchParams.get("token")).toBeTruthy();
  });

  test("signing out ends the session", async () => {
    const agent = await signIn("casey@example.com");

    await agent.post("/api/auth/sign-out").send({}).expect(200);

    expect((await agent.get("/api/me")).status).toBe(401);
  });

  // a first sign-in proves the email and clears any older access, under a
  // one-at-a-time lock that Better Auth keys by its own id; ids we generate
  // must not replace it (Better Auth warns, and the lock stops locking)
  test("a first sign-in keeps Better Auth's lock intact", async () => {
    const warn = vi.spyOn(console, "warn");

    await signIn("casey@example.com");

    expect(warn.mock.calls.flat().join(" ")).not.toContain("Invalid UUID");
  });
});

describe("connecting an Account to its records (ADR-0006)", () => {
  test("connects to the Staff member with the same email", async () => {
    await createStaff({
      email: "Olive@Example.com",
      name: "Olive Owner",
      roles: ["office_staff"],
    });

    const account = await me(await signIn("olive@example.com"));

    expect(account).toMatchObject({
      name: "Olive Owner",
      roles: ["office_staff"],
    });
  });

  test("connects to the Client with the same email", async () => {
    await createClient({
      email: "casey@example.com",
      name: "Casey Client",
      phone: "(646) 555-0100",
    });

    const account = await me(await signIn("casey@example.com"));

    expect(account).toMatchObject({ name: "Casey Client", roles: ["client"] });
  });

  test("a record added after sign-up connects straight away", async () => {
    const agent = await signIn("casey@example.com");

    await createClient({
      email: "casey@example.com",
      name: "Casey Client",
      phone: "(646) 555-0100",
    });

    expect((await me(agent)).roles).toEqual(["client"]);
  });

  test("a connection survives the record's email changing", async () => {
    const client = await createClient({
      email: "casey@example.com",
      name: "Casey Client",
      phone: "(646) 555-0100",
    });
    const agent = await signIn("casey@example.com");

    await changeClientEmail(client.id, "casey@work.example.com");

    expect((await me(agent)).roles).toEqual(["client"]);
    expect((await me(await signIn("casey@example.com"))).roles).toEqual([
      "client",
    ]);
  });

  test("correcting a Client's email to a signed-up Account connects it", async () => {
    // signed up with a different email from the one they asked for a Quote with
    const agent = await signIn("casey.personal@example.com");
    const client = await createClient({
      email: "casey@work.example.com",
      name: "Casey Client",
      phone: "(646) 555-0100",
    });
    expect((await me(agent)).roles).toEqual([]);

    await changeClientEmail(client.id, "casey.personal@example.com");

    expect((await me(agent)).roles).toEqual(["client"]);
  });

  test("one Account can be both a Client and Staff", async () => {
    await createStaff({
      email: "cory@example.com",
      name: "Cory Cleaner",
      roles: ["cleaner"],
    });
    await createClient({
      email: "cory@example.com",
      name: "Cory Cleaner",
      phone: "(646) 555-0100",
    });

    const account = await me(await signIn("cory@example.com"));

    expect(account.roles).toEqual(["cleaner", "client"]);
  });

  test("a deactivated Staff member has no Staff access", async () => {
    const member = await createStaff({
      email: "cory@example.com",
      name: "Cory Cleaner",
      roles: ["cleaner"],
    });
    const agent = await signIn("cory@example.com");

    await deactivateStaff(member.id);

    expect((await me(agent)).roles).toEqual([]);
  });

  // the Office sees an Account's picture, so only Google may set it (#243)
  test("callers can't set their own picture", async () => {
    const agent = await signIn("casey@example.com");

    const res = await agent
      .post("/api/auth/update-user")
      .send({ image: "https://evil.example/x.png" });

    expect(res.status).toBe(400);
    const session = await agent.get("/api/auth/get-session").expect(200);
    expect(session.body.user.image).toBeNull();
  });

  test("callers can't give themselves Staff access", async () => {
    const agent = await signIn("casey@example.com");

    await agent.post("/api/auth/update-user").send({ roles: ["office_staff"] });

    expect((await me(agent)).roles).toEqual([]);
  });
});

// a session lives only in its cookie (#229): no token is handed out for
// scripts to keep, and the cookie's own value is no use as a bearer token
test("a session is the cookie, never a bearer token", async () => {
  await api()
    .post("/api/auth/sign-in/magic-link")
    .send({ email: "cory@example.com", callbackURL: "/" })
    .expect(200);

  const verify = await api().get(signInButtonFor("cory@example.com"));
  const cookies = verify.headers["set-cookie"] as unknown as string[];
  const session = cookies
    .find((cookie) => cookie.includes("session_token="))
    ?.split(";")[0]
    ?.split("=")[1];
  const res = await api()
    .get("/api/me")
    .set("Authorization", `Bearer ${session}`);

  expect(session).toBeTruthy();
  expect(verify.headers).not.toHaveProperty("set-auth-token");
  expect(res.status).toBe(401);
});

describe("Google", () => {
  const google = { sub: "107229176673569254139", email: "casey@example.com" };

  test("works as the very first sign-in, and again next time", async () => {
    await createClient({
      email: "casey@example.com",
      name: "Casey Client",
      phone: "(646) 555-0100",
    });

    const first = await signInWithGoogle(google);
    const again = await signInWithGoogle(google);

    for (const { agent, callback } of [first, again]) {
      expect(callback.status).toBe(302);
      expect(callback.headers.location).not.toContain("error");
      expect(await me(agent)).toMatchObject({
        email: "casey@example.com",
        roles: ["client"],
      });
    }
  });

  test("signs in to the same Account as the emailed link", async () => {
    const byLink = await me(await signIn("casey@example.com"));

    const { agent } = await signInWithGoogle(google);

    expect((await me(agent)).id).toBe(byLink.id);
  });

  // Google is asked to prove the address like any other way in (#243)
  test("an address Google hasn't proven doesn't sign in to the Account", async () => {
    await signIn("casey@example.com");

    const { agent, callback } = await signInWithGoogle({
      ...google,
      emailVerified: false,
    });

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toContain("error=account_not_linked");
    await agent.get("/api/me").expect(401);
  });

  test("a new Google address signs up, connected to nothing", async () => {
    const { agent, callback } = await signInWithGoogle(google);

    expect(callback.headers.location).not.toContain("error");
    expect((await me(agent)).roles).toEqual([]);
  });

  test("a sign-in that fails part-way lands on the app's sign-in page", async () => {
    // e.g. a stale or tampered callback; never Better Auth's own error page
    const res = await api().get(
      "/api/auth/callback/google?code=google-code&state=not-a-real-state",
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(
      /^http:\/\/localhost:5173\/sign-in\?error=/,
    );
  });

  test("starts by sending the person to Google", async () => {
    const res = await api()
      .post("/api/auth/sign-in/social")
      .send({ provider: "google", callbackURL: "/" });

    expect(res.status).toBe(200);
    expect(new URL(res.body.url).host).toBe("accounts.google.com");
  });
});

describe("authorize()", () => {
  // a stand-in endpoint: real ones arrive with the feature tickets
  const app = express();
  app.get("/office-only", authorize("office_staff"), (_req, res) => {
    res.json({ hello: signedInAccount(res).name });
  });
  app.get("/staff", authorize("cleaner", "office_staff"), (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/anyone", authorize(), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);

  // sign in on the real app, then present that session to the stand-in endpoints
  const sessionCookieFor = async (email: string) => {
    await api()
      .post("/api/auth/sign-in/magic-link")
      .send({ email, callbackURL: "/" })
      .expect(200);
    const verify = await api().get(signInButtonFor(email)).expect(302);
    return verify.headers["set-cookie"] as unknown as string[];
  };

  test("rejects Guests with 401 in the API's error format", async () => {
    const res = await request(app).get("/office-only");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  test("lets in any signed-in Account when no role is asked for", async () => {
    const res = await request(app)
      .get("/anyone")
      .set("Cookie", await sessionCookieFor("new@example.com"));

    expect(res.status).toBe(200);
  });

  test("rejects Accounts without one of the roles with 403", async () => {
    await createClient({
      email: "casey@example.com",
      name: "Casey Client",
      phone: "(646) 555-0100",
    });

    const res = await request(app)
      .get("/office-only")
      .set("Cookie", await sessionCookieFor("casey@example.com"));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Forbidden" });
  });

  test("lets in Accounts holding any of the roles", async () => {
    await createStaff({
      email: "cory@example.com",
      name: "Cory Cleaner",
      roles: ["cleaner"],
    });
    const cookie = await sessionCookieFor("cory@example.com");

    const staff = await request(app).get("/staff").set("Cookie", cookie);
    const officeOnly = await request(app)
      .get("/office-only")
      .set("Cookie", cookie);

    expect(staff.status).toBe(200);
    expect(officeOnly.status).toBe(403);
  });

  test("/api/me requires a signed-in Account", async () => {
    const res = await api().get("/api/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });
});

describe("owner setup", () => {
  test("creates the first Office Staff member, who signs up to get in", async () => {
    await createOwner({ email: "Owner@Example.com", name: "Olive Owner" });

    const account = await me(await signIn("owner@example.com"));

    expect(account).toMatchObject({
      email: "owner@example.com",
      name: "Olive Owner",
      roles: ["office_staff"],
    });
  });

  // the script only bootstraps a fresh install; the owner invites further
  // Office Staff from the app (#7)
  test("the setup script refuses to run a second time", async () => {
    await createOwner({ email: "owner@example.com", name: "Olive Owner" });

    await expect(
      createOwner({ email: "second@example.com", name: "Sam Second" }),
    ).rejects.toThrow("an Office Staff member already exists");
  });

  test("there can be any number of Office Staff", async () => {
    await createOwner({ email: "owner@example.com", name: "Olive Owner" });
    await createStaff({
      email: "second@example.com",
      name: "Sam Second",
      roles: ["office_staff"],
    });

    expect((await me(await signIn("second@example.com"))).roles).toEqual([
      "office_staff",
    ]);
  });
});
