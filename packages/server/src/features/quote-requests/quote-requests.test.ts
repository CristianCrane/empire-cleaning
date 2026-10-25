import { describe, expect, test } from "vitest";
import type {
  NewProperty,
  QuoteRequestSubmission,
} from "@empire-cleaning/models";
import { db } from "#db";
import { createStaff } from "#features/staff";
import { api, apiAgent, signIn, testEmail } from "../../../tests/harness.ts";
import { quoteRequests } from "./quote-requests.schema.ts";

const home: NewProperty = {
  type: "apartment",
  street: "41-12 Austin St",
  unit: "4B",
  postcode: "11375",
  bedrooms: 2,
  bathrooms: 1.5,
  storeys: 1,
  pets: true,
  floorArea: null,
  accessInstructions: "Ring 4B; the doorman has a key.",
};

const casey = {
  name: "Casey Client",
  email: "casey@example.com",
  phone: "(646) 555-0100",
};

const guestRequest = (
  overrides: Partial<QuoteRequestSubmission> = {},
): QuoteRequestSubmission => ({
  contact: casey,
  property: { new: home },
  condition: "moderate",
  wantsRegularService: true,
  notes: null,
  ...overrides,
});

const submit = (
  body: unknown,
  agent: ReturnType<typeof apiAgent> | ReturnType<typeof api> = api(),
) => agent.post("/api/quote-requests").send(body as object);

const signInAsOffice = async () => {
  await createStaff({
    email: "olive@example.com",
    name: "Olive Owner",
    roles: ["office_staff"],
  });
  return signIn("olive@example.com");
};

describe("a Guest's Quote Request", () => {
  test("creates the Client, Property and Quote Request, and no Account", async () => {
    const res = await submit(guestRequest());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      emailedTo: "casey@example.com",
    });
    // nobody is signed in by submitting
    expect(res.headers["set-cookie"]).toBeUndefined();

    const office = await signInAsOffice();
    const [listed] = (await office.get("/api/quote-requests")).body;
    expect(listed).toMatchObject({
      client: { name: "Casey Client" },
      property: { street: "41-12 Austin St", unit: "4B", bathrooms: 1.5 },
      condition: "moderate",
      wantsRegularService: true,
    });
  });

  test("emails a receipt saying where the Quote will go", async () => {
    await submit(guestRequest());

    const receipt = testEmail().lastTo("casey@example.com");
    expect(receipt.subject).toBe("We've received your Quote Request");
    expect(receipt.text).toContain("41-12 Austin St, 4B, 11375");
    expect(receipt.text).toContain(
      "We'll email your Quote to casey@example.com",
    );
    // a receipt never signs anyone in (ADR-0006)
    expect(receipt.text).not.toMatch(/https?:\/\//);
  });

  test("is connected to the Account when that email signs up later", async () => {
    await submit(guestRequest());

    const agent = await signIn("casey@example.com");
    const me = (await agent.get("/api/clients/me")).body;

    expect(me).toMatchObject({ name: "Casey Client", phone: casey.phone });
    expect(me.properties).toHaveLength(1);
    expect(me.quoteRequests).toHaveLength(1);
  });

  test("with an existing Client's email, joins that Client without changing them", async () => {
    await submit(guestRequest());

    await submit(
      guestRequest({
        contact: {
          name: "Someone Else",
          email: "CASEY@example.com",
          phone: "(212) 555-0199",
        },
        property: { new: { ...home, street: "108-20 71st Ave", unit: null } },
      }),
    );

    const me = (
      await (await signIn("casey@example.com")).get("/api/clients/me")
    ).body;
    expect(me).toMatchObject({ name: "Casey Client", phone: casey.phone });
    expect(me.properties).toHaveLength(2);
    expect(me.quoteRequests).toHaveLength(2);
    // the real owner hears about it, at their own address
    const receipts = testEmail()
      .to("casey@example.com")
      .filter((m) => m.subject === "We've received your Quote Request");
    expect(receipts).toHaveLength(2);
  });

  test("explains what's wrong, field by field, in the API's error format", async () => {
    const res = await submit(
      guestRequest({
        contact: { ...casey, email: "casey@", phone: "555" },
        property: { new: { ...home, postcode: "1137", bathrooms: 1.25 } },
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid request body");
    const issues = Object.fromEntries(
      res.body.details.map((d: { path: string; issue: string }) => [
        d.path,
        d.issue,
      ]),
    );
    expect(issues).toMatchObject({
      "contact.email": "Enter a full email address, like name@example.com",
      "contact.phone": "Enter a phone number with its area code",
      "property.new.postcode": "Enter a 5-digit ZIP code",
      "property.new.bathrooms": "Use whole or half bathrooms, like 1.5",
    });
  });

  test("can't name an existing Property", async () => {
    const res = await submit(
      guestRequest({
        property: { existing: "00000000-0000-4000-8000-000000000000" },
      }),
    );

    expect(res.status).toBe(400);
  });

  test("is accepted from the landing site", async () => {
    const res = await api()
      .options("/api/quote-requests")
      .set("Origin", "http://localhost:4321")
      .set("Access-Control-Request-Method", "POST");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:4321",
    );
  });
});

const ownHomes = async (email: string) =>
  (await (await signIn(email)).get("/api/clients/me")).body;

describe("one address is one home", () => {
  // Quote Requests stay waiting until #5 and #6 let them end, so a home is
  // freed for a new request by removing its request here
  const resolveAll = () => db.delete(quoteRequests);

  test.each([
    ["spelled out", "41-12 Austin Street", "Apt 4B"],
    ["with punctuation and capitals", "41-12 AUSTIN ST.", "#4b"],
    ["with the hyphen as a space", "41 12 Austin St", "apartment 4B"],
  ])("the same address %s is the same home", async (_, street, unit) => {
    await submit(guestRequest());
    await resolveAll();

    await submit(
      guestRequest({ property: { new: { ...home, street, unit } } }),
    ).expect(201);

    expect((await ownHomes("casey@example.com")).properties).toHaveLength(1);
  });

  test("a different unit in the same building is a different home", async () => {
    await submit(guestRequest());

    await submit(
      guestRequest({ property: { new: { ...home, unit: "5A" } } }),
    ).expect(201);

    expect((await ownHomes("casey@example.com")).properties).toHaveLength(2);
  });

  test("a home keeps its details when the address is entered again", async () => {
    await submit(guestRequest());
    await resolveAll();

    await submit(
      guestRequest({
        condition: "heavy",
        property: { new: { ...home, bedrooms: 5, pets: false } },
      }),
    ).expect(201);

    const { properties } = await ownHomes("casey@example.com");
    expect(properties).toHaveLength(1);
    // the details stay as first given; only the Condition is restated
    expect(properties[0]).toMatchObject({
      bedrooms: 2,
      pets: true,
      condition: "heavy",
    });
  });

  test("each Client has their own record of an address", async () => {
    await submit(guestRequest());
    await submit(
      guestRequest({
        contact: {
          name: "Dana Doe",
          email: "dana@example.com",
          phone: casey.phone,
        },
      }),
    ).expect(201);

    expect((await ownHomes("casey@example.com")).properties).toHaveLength(1);
    expect((await ownHomes("dana@example.com")).properties).toHaveLength(1);
  });
});

describe("one pending request per home", () => {
  const refusal =
    "You've already asked us for a Quote for this home. We'll email it to casey@example.com soon.";

  test("a Guest asking again about the same home is told one is on its way", async () => {
    await submit(guestRequest());

    const res = await submit(guestRequest());

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(refusal);
    const me = await ownHomes("casey@example.com");
    expect(me.quoteRequests).toHaveLength(1);
    // no second receipt either
    const receipts = testEmail()
      .to("casey@example.com")
      .filter((m) => m.subject === "We've received your Quote Request");
    expect(receipts).toHaveLength(1);
  });

  test("a Client choosing one of their homes is told the same", async () => {
    await submit(guestRequest());
    const agent = await signIn("casey@example.com");
    const [property] = (await agent.get("/api/clients/me")).body.properties;

    const res = await submit(
      {
        property: { existing: property.id },
        condition: "light",
        wantsRegularService: false,
      },
      agent,
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(refusal);
  });

  test("a Client entering the address of a home with a pending request is told the same", async () => {
    await submit(guestRequest());
    const agent = await signIn("casey@example.com");

    const res = await submit(
      {
        property: { new: { ...home, street: "41-12 Austin Street" } },
        condition: "light",
        wantsRegularService: false,
      },
      agent,
    );

    expect(res.status).toBe(409);
  });
});

describe("the receipt email", () => {
  test("failing to send doesn't lose or fail the request", async () => {
    testEmail().failSending();

    const res = await submit(guestRequest());
    testEmail().sendNormally();

    expect(res.status).toBe(201);
    expect(res.body.emailedTo).toBe("casey@example.com");
    expect((await ownHomes("casey@example.com")).quoteRequests).toHaveLength(1);
  });
});

describe("a signed-in Account connected to no Client", () => {
  test("becomes that Client, with its proven email, connected straight away", async () => {
    const agent = await signIn("casey@example.com");

    const res = await submit(
      { ...guestRequest(), contact: { name: casey.name, phone: casey.phone } },
      agent,
    );

    expect(res.status).toBe(201);
    expect(res.body.emailedTo).toBe("casey@example.com");
    expect((await agent.get("/api/me")).body.roles).toEqual(["client"]);
    expect(
      (await agent.get("/api/clients/me")).body.quoteRequests,
    ).toHaveLength(1);
  });

  test("needs a name and phone", async () => {
    const agent = await signIn("casey@example.com");

    const res = await submit({ ...guestRequest(), contact: undefined }, agent);

    expect(res.status).toBe(400);
  });
});

describe("a signed-in Client", () => {
  const asClient = async () => {
    await submit(guestRequest());
    const agent = await signIn("casey@example.com");
    const me = (await agent.get("/api/clients/me")).body;
    return { agent, property: me.properties[0] };
  };

  test("can ask about a new Property", async () => {
    const { agent } = await asClient();

    await submit(
      {
        property: { new: { ...home, street: "35-06 Ditmars Blvd" } },
        condition: "light",
        wantsRegularService: false,
      },
      agent,
    ).expect(201);

    expect((await agent.get("/api/clients/me")).body.properties).toHaveLength(
      2,
    );
  });

  test("can ask again about one of their Properties, restating its Condition", async () => {
    const { agent, property } = await asClient();
    // the earlier request has been dealt with (see "one address is one home")
    await db.delete(quoteRequests);

    await submit(
      {
        property: { existing: property.id },
        condition: "heavy",
        wantsRegularService: false,
        notes: "After a party",
      },
      agent,
    ).expect(201);

    const me = (await agent.get("/api/clients/me")).body;
    expect(me.properties).toEqual([
      expect.objectContaining({ id: property.id, condition: "heavy" }),
    ]);
    expect(me.quoteRequests[0]).toMatchObject({
      condition: "heavy",
      notes: "After a party",
    });
  });

  test("can't name someone else's Property", async () => {
    const { property } = await asClient();
    const stranger = await signIn("stranger@example.com");
    await submit(
      {
        ...guestRequest(),
        contact: { name: "Sam Stranger", phone: casey.phone },
      },
      stranger,
    );

    const res = await submit(
      {
        property: { existing: property.id },
        condition: "light",
        wantsRegularService: false,
      },
      stranger,
    );

    expect(res.status).toBe(404);
  });

  test("can edit their contact details", async () => {
    const { agent } = await asClient();

    const res = await agent.patch("/api/clients/me").send({
      name: "Casey C. Client",
      email: "casey@work.example.com",
      phone: "(718) 555-0123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Casey C. Client",
      email: "casey@work.example.com",
    });
    // still connected after the email change (ADR-0006)
    expect((await agent.get("/api/me")).body.roles).toEqual(["client"]);
  });

  test("can't take another Client's email", async () => {
    const { agent } = await asClient();
    await submit(
      guestRequest({ contact: { ...casey, email: "dana@example.com" } }),
    );

    const res = await agent
      .patch("/api/clients/me")
      .send({ ...casey, email: "dana@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatchObject({
      path: "email",
      issue: "That email is already used by another Client",
    });
  });

  test("can edit Access Instructions", async () => {
    const { agent, property } = await asClient();

    await agent
      .patch(`/api/properties/${property.id}/access-instructions`)
      .send({ accessInstructions: "Key in the lockbox, code 4821" })
      .expect(200);

    const me = (await agent.get("/api/clients/me")).body;
    expect(me.properties[0].accessInstructions).toBe(
      "Key in the lockbox, code 4821",
    );
  });

  test("can't change price-affecting details", async () => {
    const { agent, property } = await asClient();

    const res = await agent
      .patch(`/api/properties/${property.id}`)
      .send({ bedrooms: 1, condition: "light" });

    expect(res.status).toBe(403);
    const me = (await agent.get("/api/clients/me")).body;
    expect(me.properties[0]).toMatchObject({
      bedrooms: 2,
      condition: "moderate",
    });
  });

  test("can't see or change another Client's records", async () => {
    const { property } = await asClient();
    const dana = await signIn("dana@example.com");
    await submit(
      { ...guestRequest(), contact: { name: "Dana Doe", phone: casey.phone } },
      dana,
    );

    const view = await dana.get(`/api/clients/${property.id}`);
    const edit = await dana
      .patch(`/api/properties/${property.id}/access-instructions`)
      .send({ accessInstructions: "nope" });

    expect(view.status).toBe(403);
    expect(edit.status).toBe(404);
  });
});

describe("Office Staff", () => {
  test("see open Quote Requests, newest first", async () => {
    await submit(guestRequest());
    await submit(
      guestRequest({
        contact: { ...casey, name: "Dana Doe", email: "dana@example.com" },
      }),
    );
    const office = await signInAsOffice();

    const listed = (await office.get("/api/quote-requests")).body;

    expect(
      listed.map((r: { client: { name: string } }) => r.client.name),
    ).toEqual(["Dana Doe", "Casey Client"]);
  });

  test("view a Client with their Properties and Quote Requests", async () => {
    await submit(guestRequest());
    const office = await signInAsOffice();
    const [request] = (await office.get("/api/quote-requests")).body;

    const client = (await office.get(`/api/clients/${request.client.id}`)).body;

    expect(client).toMatchObject({
      name: "Casey Client",
      email: "casey@example.com",
    });
    expect(client.properties).toHaveLength(1);
    expect(client.quoteRequests).toHaveLength(1);
  });

  test("correct any of a Property's details, but not its address", async () => {
    await submit(guestRequest());
    const office = await signInAsOffice();
    const [request] = (await office.get("/api/quote-requests")).body;

    await office
      .patch(`/api/properties/${request.propertyId}`)
      .send({
        type: "townhouse",
        bedrooms: 3,
        bathrooms: 2,
        storeys: 2,
        pets: false,
        floorArea: 1400,
        condition: "heavy",
      })
      .expect(200);

    const client = (await office.get(`/api/clients/${request.client.id}`)).body;
    expect(client.properties[0]).toMatchObject({
      type: "townhouse",
      bedrooms: 3,
      bathrooms: 2,
      storeys: 2,
      pets: false,
      floorArea: 1400,
      condition: "heavy",
      street: "41-12 Austin St",
    });
  });

  test("correcting details explains what's wrong, field by field", async () => {
    await submit(guestRequest());
    const office = await signInAsOffice();
    const [request] = (await office.get("/api/quote-requests")).body;

    const res = await office
      .patch(`/api/properties/${request.propertyId}`)
      .send({ bathrooms: 1.25 });

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatchObject({
      path: "bathrooms",
      issue: "Use whole or half bathrooms, like 1.5",
    });
  });

  test("are the only ones who see the list", async () => {
    await submit(guestRequest());
    const agent = await signIn("casey@example.com");

    expect((await agent.get("/api/quote-requests")).status).toBe(403);
    expect((await api().get("/api/quote-requests")).status).toBe(401);
  });
});
