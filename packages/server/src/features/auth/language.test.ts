import { describe, expect, test } from "vitest";
import {
  api,
  emailedLinkFor,
  signIn,
  testEmail,
  testPayments,
} from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { SEEDED } from "#features/services";
import { createStaff } from "#features/staff";

// A person's Preferred Language (ADR-0025, #303, #305, #306): the web app
// reads each area's from /api/me; their own choice of it writes every
// Client and Staff member their Account is connected to, the Office's the
// one record it sets; and the payment provider's own pages follow it

const me = async (agent: Awaited<ReturnType<typeof signIn>>) =>
  (await agent.get("/api/me").expect(200)).body;

describe("a person's own language", () => {
  test("is the portal's from their Client, the Cleaner area's from their Staff member, none where there's no record", async () => {
    await submit(guestAsk()).set("Accept-Language", "es").expect(201);
    expect((await me(await signIn(casey.email))).languages).toEqual({
      portal: "es",
      cleaner: null,
    });
    await createStaff({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
    });
    expect((await me(await signIn("cory@example.com"))).languages).toEqual({
      portal: null,
      cleaner: "en",
    });
    expect((await me(await signIn("new@example.com"))).languages).toEqual({
      portal: null,
      cleaner: null,
    });
  });

  test("changes on every record they are, a Client and a Staff member alike", async () => {
    await submit(guestAsk()).expect(201);
    await createStaff({
      name: casey.name,
      email: casey.email,
      roles: ["cleaner"],
    });
    const both = await signIn(casey.email);

    await both.put("/api/me/language").send({ language: "es" }).expect(204);

    expect((await me(both)).languages).toEqual({ portal: "es", cleaner: "es" });
  });

  test("changes on their Client, and with the payment provider", async () => {
    await submit(guestAsk()).expect(201);
    const client = await signIn(casey.email);
    await savesACard(client);
    expect(testPayments().payers).toEqual([
      expect.objectContaining({ language: "en" }),
    ]);

    await client.put("/api/me/language").send({ language: "es" }).expect(204);

    expect((await me(client)).languages.portal).toBe("es");
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

// a payer for the signed-in Client, made when a card is first saved
const savesACard = async (client: Awaited<ReturnType<typeof signIn>>) => {
  const form = (
    await client.post("/api/payment-methods/mine/card-form").expect(200)
  ).body as { secret: string };
  await client
    .put("/api/payment-methods/mine")
    .send({ token: form.secret })
    .expect(200);
};

describe("a language the Office sets (#306)", () => {
  test("is a Staff member's as they're invited, and again as they're brought back, the invitation in it", async () => {
    const office = await signInAsOffice();
    const cory = { name: "Cory Cleaner", email: "cory@example.com" };
    const invited = (
      await office
        .post("/api/staff")
        .send({ ...cory, roles: ["cleaner"], preferredLanguage: "es" })
        .expect(201)
    ).body;
    expect(invited.preferredLanguage).toBe("es");
    expect(testEmail().lastTo(cory.email).subject).toBe(
      "Te invitamos a unirte a Empire Cleaning",
    );

    // brought back, with the language given now
    await office.post(`/api/staff/${invited.id}/deactivate`).expect(200);
    const back = (
      await office
        .post("/api/staff")
        .send({ ...cory, roles: ["cleaner"], preferredLanguage: "en" })
        .expect(201)
    ).body;
    expect(back.preferredLanguage).toBe("en");
    expect(testEmail().lastTo(cory.email).subject).toBe(
      "You're invited to join Empire Cleaning",
    );
  });

  test("changes a Staff member's alone, not the Client their Account also is", async () => {
    await submit(guestAsk()).expect(201);
    const office = await signInAsOffice();
    const member = (
      await office
        .post("/api/staff")
        .send({ name: casey.name, email: casey.email, roles: ["cleaner"] })
        .expect(201)
    ).body;
    expect(member.preferredLanguage).toBe("en");

    const edited = (
      await office
        .patch(`/api/staff/${member.id}`)
        .send({ name: casey.name, roles: ["cleaner"], preferredLanguage: "es" })
        .expect(200)
    ).body;
    expect(edited.preferredLanguage).toBe("es");
    expect((await me(await signIn(casey.email))).languages).toEqual({
      portal: "en",
      cleaner: "es",
    });

    // an edit that doesn't give it leaves it
    await office
      .patch(`/api/staff/${member.id}`)
      .send({ name: "Casey C", roles: ["cleaner"] })
      .expect(200);
    expect((await me(await signIn(casey.email))).languages.cleaner).toBe("es");
  });

  test("is a caller's as the Office enters them, and changes on that Client alone, and with the payment provider", async () => {
    const office = await signInAsOffice();
    const entered = (
      await office
        .post("/api/quotes/caller")
        .send({
          contact: {
            name: casey.name,
            email: casey.email,
            phone: casey.phone,
            preferredLanguage: "es",
          },
          property: { new: home },
          serviceKey: SEEDED.standard,
          condition: "moderate",
          wantsRegularService: false,
          addOns: [],
        })
        .expect(201)
    ).body as { quoteId: string };
    const clientId = (
      await office.get(`/api/quotes/${entered.quoteId}`).expect(200)
    ).body.client.id as string;
    const page = async () =>
      (await office.get(`/api/clients/${clientId}`).expect(200)).body;
    expect((await page()).preferredLanguage).toBe("es");

    await createStaff({
      name: casey.name,
      email: casey.email,
      roles: ["cleaner"],
    });
    const client = await signIn(casey.email);
    await savesACard(client);
    expect(testPayments().payers).toEqual([
      expect.objectContaining({ language: "es" }),
    ]);

    const details = {
      name: casey.name,
      email: casey.email,
      phone: casey.phone,
    };
    await office
      .patch(`/api/clients/${clientId}`)
      .send({ ...details, preferredLanguage: "en" })
      .expect(200);
    expect((await page()).preferredLanguage).toBe("en");
    expect(testPayments().payers).toEqual([
      expect.objectContaining({ language: "en" }),
    ]);
    expect((await me(client)).languages).toEqual({
      portal: "en",
      cleaner: "en",
    });

    // corrections that don't give it leave it
    await office
      .patch(`/api/clients/${clientId}`)
      .send({ ...details, preferredLanguage: "es" })
      .expect(200);
    await office.patch(`/api/clients/${clientId}`).send(details).expect(200);
    expect((await page()).preferredLanguage).toBe("es");
    expect((await me(client)).languages.cleaner).toBe("en");
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
