import { describe, expect, test, vi } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "#middleware";
import { authorize, createAccount, signedInAccount } from "#features/auth";
import { createOwner } from "./create-owner.ts";
import {
  api,
  apiAgent,
  signIn,
  signInLinkFor,
  testEmail,
} from "../../../tests/harness.ts";

describe("signing in with a one-time link", () => {
  test("emails a link that signs the Account in", async () => {
    await createAccount({
      email: "client@example.com",
      name: "Casey Client",
      roles: ["client"],
    });

    const agent = await signIn("client@example.com");
    const me = await agent.get("/api/me");

    expect(testEmail().lastTo("client@example.com").subject).toBe(
      "Sign in to Empire Cleaning",
    );
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      email: "client@example.com",
      name: "Casey Client",
      roles: ["client"],
    });
  });

  test("an unknown email gets the same response but no email", async () => {
    const res = await api()
      .post("/api/auth/sign-in/magic-link")
      .send({ email: "stranger@example.com", callbackURL: "/" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: true });
    expect(testEmail().sent).toEqual([]);
  });

  test("a link signs in only once", async () => {
    await createAccount({
      email: "client@example.com",
      name: "Casey Client",
      roles: ["client"],
    });
    await signIn("client@example.com");
    const link = signInLinkFor("client@example.com");

    const second = apiAgent();
    await second.get(link);
    const me = await second.get("/api/me");

    expect(me.status).toBe(401);
  });

  test("signing in never creates an Account", async () => {
    const agent = apiAgent();
    await agent
      .post("/api/auth/sign-in/magic-link")
      .send({ email: "stranger@example.com", callbackURL: "/" });

    const me = await agent.get("/api/me");

    expect(me.status).toBe(401);
  });

  test("signed-in callers cannot grant themselves roles", async () => {
    await createAccount({
      email: "client@example.com",
      name: "Casey Client",
      roles: ["client"],
    });
    const agent = await signIn("client@example.com");

    const res = await agent
      .post("/api/auth/update-user")
      .send({ roles: ["office_staff"] });
    const me = await agent.get("/api/me");

    // 400, not 403: Clients may update their own Account, just not this field
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("roles is not allowed to be set");
    expect(me.body.roles).toEqual(["client"]);
  });

  // a first sign-in proves the email and clears any older access, under a
  // one-at-a-time lock that Better Auth keys by its own id; ids we generate
  // must not replace it (Better Auth warns, and the lock stops locking)
  test("a first sign-in keeps Better Auth's lock intact", async () => {
    await createAccount({
      email: "client@example.com",
      name: "Casey Client",
      roles: ["client"],
    });
    const warn = vi.spyOn(console, "warn");

    await signIn("client@example.com");

    expect(warn.mock.calls.flat().join(" ")).not.toContain("Invalid UUID");
  });

  test("signing out ends the session", async () => {
    await createAccount({
      email: "client@example.com",
      name: "Casey Client",
      roles: ["client"],
    });
    const agent = await signIn("client@example.com");

    await agent.post("/api/auth/sign-out").send({}).expect(200);
    const me = await agent.get("/api/me");

    expect(me.status).toBe(401);
  });
});

describe("non-browser clients", () => {
  test("can sign in with a bearer token instead of a cookie", async () => {
    await createAccount({
      email: "cleaner@example.com",
      name: "Cory Cleaner",
      roles: ["cleaner"],
    });
    await api()
      .post("/api/auth/sign-in/magic-link")
      .send({ email: "cleaner@example.com", callbackURL: "/" })
      .expect(200);

    const verify = await api().get(signInLinkFor("cleaner@example.com"));
    const token = verify.headers["set-auth-token"];
    const me = await api()
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.email).toBe("cleaner@example.com");
  });

  test("a made-up bearer token is rejected", async () => {
    const me = await api()
      .get("/api/me")
      .set("Authorization", "Bearer not-a-real-token");

    expect(me.status).toBe(401);
  });
});

describe("Google sign-in", () => {
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
  app.get("/office-only", authorize("office_staff"), (req, res) => {
    res.json({ hello: signedInAccount(res).name });
  });
  app.get("/staff", authorize("cleaner", "office_staff"), (req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);

  // sign in on the real app, then present that session to the stand-in endpoints
  const sessionCookieFor = async (email: string) => {
    await api()
      .post("/api/auth/sign-in/magic-link")
      .send({ email, callbackURL: "/" })
      .expect(200);
    const verify = await api().get(signInLinkFor(email)).expect(302);
    return verify.headers["set-cookie"] as unknown as string[];
  };

  test("rejects Guests with 401 in the API's error format", async () => {
    const res = await request(app).get("/office-only");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  test("rejects Accounts without one of the roles with 403", async () => {
    await createAccount({
      email: "client@example.com",
      name: "Casey Client",
      roles: ["client"],
    });

    const res = await request(app)
      .get("/office-only")
      .set("Cookie", await sessionCookieFor("client@example.com"));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Forbidden" });
  });

  test("lets in Accounts holding any of the roles", async () => {
    await createAccount({
      email: "cleaner@example.com",
      name: "Cory Cleaner",
      roles: ["cleaner"],
    });

    const staff = await request(app)
      .get("/staff")
      .set("Cookie", await sessionCookieFor("cleaner@example.com"));
    const officeOnly = await request(app)
      .get("/office-only")
      .set("Cookie", await sessionCookieFor("cleaner@example.com"));

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
  test("creates the first Office Staff Account, who can then sign in", async () => {
    await createOwner({ email: "Owner@Example.com", name: "Olive Owner" });

    const agent = await signIn("owner@example.com");
    const me = await agent.get("/api/me");

    expect(me.body).toMatchObject({
      email: "owner@example.com",
      roles: ["office_staff"],
    });
  });

  // the script only bootstraps a fresh install; the owner invites further
  // Office Staff from the app (#7)
  test("the setup script refuses to run a second time", async () => {
    await createOwner({ email: "owner@example.com", name: "Olive Owner" });

    await expect(
      createOwner({ email: "second@example.com", name: "Sam Second" }),
    ).rejects.toThrow("an Office Staff Account already exists");
  });

  test("there can be any number of Office Staff Accounts", async () => {
    await createOwner({ email: "owner@example.com", name: "Olive Owner" });
    await createAccount({
      email: "second@example.com",
      name: "Sam Second",
      roles: ["office_staff"],
    });

    const agent = await signIn("second@example.com");
    const me = await agent.get("/api/me");

    expect(me.body.roles).toEqual(["office_staff"]);
  });
});

test("a Client Account cannot also hold Staff roles", async () => {
  await expect(
    createAccount({
      email: "mixed@example.com",
      name: "Mixed",
      roles: ["client", "cleaner"],
    }),
  ).rejects.toThrow("a Client Account cannot also hold Staff roles");
});
