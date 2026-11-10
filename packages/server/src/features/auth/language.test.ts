import { describe, expect, test } from "vitest";
import {
  api,
  emailedLinkFor,
  signIn,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import { casey, guestAsk, submit } from "../../../tests/fixtures.ts";

// A person's Preferred Language, as their own (ADR-0025, #303): the web app
// reads it from /api/me, and their choice of it writes every Client their
// Account is connected to, and the payment provider's own pages follow it

const me = async (agent: Awaited<ReturnType<typeof signIn>>) =>
  (await agent.get("/api/me").expect(200)).body;

describe("a person's own language", () => {
  test("is their Client's, and none for an Account connected to no Client", async () => {
    await submit(guestAsk()).set("Accept-Language", "es").expect(201);
    expect((await me(await signIn(casey.email))).language).toBe("es");
    expect((await me(await signIn("new@example.com"))).language).toBeNull();
  });

  test("changes on their Client, and with the payment provider", async () => {
    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    // a payer, made when a card is first saved
    const form = (
      await client.post("/api/payment-methods/mine/card-form").expect(200)
    ).body as { secret: string };
    await client
      .put("/api/payment-methods/mine")
      .send({ token: form.secret })
      .expect(200);
    expect(testPayments().payers).toEqual([
      expect.objectContaining({ language: "en" }),
    ]);

    await client.put("/api/me/language").send({ language: "es" }).expect(204);

    expect((await me(client)).language).toBe("es");
    expect(
      (await client.get("/api/clients/me").expect(200)).body.preferredLanguage,
    ).toBe("es");
    expect(testPayments().payers).toEqual([
      expect.objectContaining({ language: "es" }),
    ]);
  });

  test("is English or Spanish, for someone signed in", async () => {
    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    await client.put("/api/me/language").send({ language: "fr" }).expect(400);
    await (
      await signIn("new@example.com")
    )
      .put("/api/me/language")
      .send({ language: "es" })
      .expect(204);
  });
});

describe("the sign-in link's email", () => {
  test("is in the language of the screen that asked, as is the page its link opens (#304)", async () => {
    const ask = (language?: string) => {
      const request = api().post("/api/auth/sign-in/magic-link");
      if (language) request.set("Accept-Language", language);
      return request
        .send({ email: "new@example.com", callbackURL: "/" })
        .expect(200);
    };

    await ask("es-MX");
    const es = testEmail().lastTo("new@example.com");
    expect(es.subject).toBe("Inicie sesión en Empire Cleaning");
    expect(es.html).toMatch(/<html[^>]* lang="es"/);
    expect(emailedLinkFor("new@example.com").searchParams.get("lang")).toBe(
      "es",
    );

    await ask();
    expect(testEmail().lastTo("new@example.com").subject).toBe(
      "Sign in to Empire Cleaning",
    );
    expect(emailedLinkFor("new@example.com").searchParams.get("lang")).toBe(
      "en",
    );
  });
});
