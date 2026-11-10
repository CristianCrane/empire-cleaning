import { describe, expect, test } from "vitest";
import { SEEDED } from "#features/services";
import { tooManyTries } from "#services/rate-limit";
import { api, signIn, testEmail } from "../../../tests/harness.ts";
import { casey, guestAsk, home, submit } from "../../../tests/fixtures.ts";

// A Guest or Client asking in Spanish (ADR-0025, #302): the API answers in
// the language the screen that asked is showing, its Accept-Language, and
// English when it names none

const inSpanish = () =>
  api().post("/api/quotes/ask").set("Accept-Language", "es");

const preferredLanguageOf = async (email: string) =>
  (await (await signIn(email)).get("/api/clients/me").expect(200)).body
    .preferredLanguage;

describe("asking in Spanish", () => {
  test("gives the form's messages in Spanish, and in English to a request that names no language", async () => {
    const tooLong = guestAsk({
      contact: { ...casey, name: "x".repeat(101) },
      property: { new: { ...home, postcode: "1137" } },
    });

    const es = await inSpanish().send(tooLong).expect(400);
    const en = await submit(tooLong).expect(400);

    const issues = (res: typeof es) =>
      Object.fromEntries(
        (res.body.details as { path: string; issue: string }[]).map((d) => [
          d.path,
          d.issue,
        ]),
      );
    expect(issues(es)).toEqual({
      "contact.name": "El nombre debe tener menos de 100 caracteres",
      "property.new.postcode": "Escriba un código postal de 5 dígitos",
    });
    expect(issues(en)).toEqual({
      "contact.name": "Keep the name under 100 characters",
      "property.new.postcode": "Enter a 5-digit ZIP code",
    });
    // whatever the browser prefers after it
    const tagged = await api()
      .post("/api/quotes/ask")
      .set("Accept-Language", "es-US,es;q=0.9,en;q=0.8")
      .send(tooLong)
      .expect(400);
    expect(issues(tagged)).toEqual(issues(es));
  });

  test("says what a business's ask needs in Spanish, once it's read", async () => {
    const res = await inSpanish()
      .send(
        guestAsk({
          serviceKey: SEEDED.commercial,
          property: {
            new: {
              kind: "commercial",
              street: "1 Main St",
              unit: null,
              postcode: "11375",
              premisesType: crypto.randomUUID(),
              floorArea: null,
              accessInstructions: null,
            },
          },
          condition: undefined,
          wantsRegularService: true,
          weekdays: [],
          preferredTime: null,
        }),
      )
      .expect(400);

    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "businessName",
          issue: "Escriba el nombre del negocio",
        }),
        expect.objectContaining({
          path: "weekdays",
          issue: "Elija los días en que quiere que limpiemos",
        }),
        expect.objectContaining({
          path: "preferredTime",
          issue: "Elija una hora de inicio",
        }),
      ]),
    );
  });

  test("refuses a Service not on offer in Spanish", async () => {
    const res = await inSpanish()
      .send(guestAsk({ serviceKey: crypto.randomUUID() }))
      .expect(400);

    expect(res.body.details).toEqual([
      expect.objectContaining({
        path: "serviceKey",
        issue: "Elija un servicio de la lista",
      }),
    ]);
  });

  test("makes the new Client's Preferred Language Spanish; a later ask in English leaves it", async () => {
    await inSpanish().send(guestAsk()).expect(201);
    expect(await preferredLanguageOf(casey.email)).toBe("es");

    await submit(
      guestAsk({ property: { new: { ...home, street: "7 Elm St" } } }),
    ).expect(201);
    expect(await preferredLanguageOf(casey.email)).toBe("es");
  });

  test("sends the receipt in the Client's Preferred Language", async () => {
    await inSpanish().send(guestAsk()).expect(201);

    const receipt = testEmail().lastTo(casey.email);
    expect(receipt.subject).toBe("Recibimos su solicitud de cotización");
    expect(receipt.text).toMatch(/^Hola, Casey:\n\n/);
    expect(receipt.text).toContain(
      "Gracias por pedirnos una cotización para 41-12 Austin St, 4B, 11375. Le enviaremos su cotización a casey@example.com",
    );
    expect(receipt.html).toContain('lang="es"');
  });

  test("sends an existing English Client their receipt in English, wherever they asked", async () => {
    await submit(guestAsk()).expect(201);

    await inSpanish()
      .send(guestAsk({ property: { new: { ...home, street: "7 Elm St" } } }))
      .expect(201);

    expect(testEmail().lastTo(casey.email).subject).toBe(
      "We got your request for a quote",
    );
  });

  test("leaves an existing Client's Preferred Language as it is", async () => {
    await submit(guestAsk()).expect(201);

    await inSpanish()
      .send(guestAsk({ property: { new: { ...home, street: "7 Elm St" } } }))
      .expect(201);

    expect(await preferredLanguageOf(casey.email)).toBe("en");
  });

  test("tells a signed-in Client their home already has a Quote open, in Spanish", async () => {
    await submit(guestAsk()).expect(201);
    const agent = await signIn(casey.email);
    const [property] = (await agent.get("/api/clients/me")).body.properties;

    const res = await agent
      .post("/api/quotes/ask")
      .set("Accept-Language", "es")
      .send({
        serviceKey: SEEDED.standard,
        property: { existing: property.id },
        condition: "moderate",
        wantsRegularService: false,
      })
      .expect(409);

    expect(res.body.message).toBe(
      "Ya nos pidió una cotización para esta casa. Se la enviaremos a casey@example.com pronto.",
    );
  });

  test("says how long to wait in Spanish", () => {
    expect(tooManyTries("es", 60)).toBe(
      "Demasiados intentos. Vuelva a intentarlo en 1 minuto, o llámenos al (646) 320-9076.",
    );
    expect(tooManyTries("es", 3 * 3600)).toContain("en 3 horas,");
    expect(tooManyTries("en", 120)).toContain("in 2 minutes,");
  });
});

describe("what the form offers, in Spanish", () => {
  test("names the Services, Add-ons and types of business in the request's language, saying replies differ by it", async () => {
    const services = await api()
      .get("/api/services/on-offer")
      .set("Accept-Language", "es")
      .expect(200);
    expect(services.headers.vary).toMatch(/Accept-Language/i);
    expect(services.body[1]).toMatchObject({
      key: SEEDED.deep,
      name: "Limpieza profunda",
      description: expect.stringMatching(/^Una limpieza de arriba abajo/),
    });
    expect(
      (await api().get("/api/services/on-offer").expect(200)).body[1].name,
    ).toBe("Deep Clean");

    const addOns = await api()
      .get(`/api/price-list/add-ons?service=${SEEDED.standard}`)
      .set("Accept-Language", "es")
      .expect(200);
    expect(addOns.body.map((a: { name: string }) => a.name)).toEqual([
      "Dentro del horno",
      "Dentro del refrigerador",
      "Dentro de los gabinetes",
      "Ventanas por dentro",
    ]);

    const types = await api()
      .get("/api/price-list/premises-types")
      .set("Accept-Language", "es")
      .expect(200);
    expect(types.body.map((t: { name: string }) => t.name)).toEqual([
      "Oficina",
      "Tienda",
      "Consultorio médico",
      "Otro",
    ]);
  });
});
