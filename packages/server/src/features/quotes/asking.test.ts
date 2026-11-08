import { describe, expect, test } from "vitest";
import { db } from "#db";
import { SEEDED } from "#features/services";
import { createStaff } from "#features/staff";
import { api, signIn, testEmail } from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { quotes } from "./quotes.schema.ts";

describe("a Guest asking for a Quote", () => {
  test("creates the Client, Property and a Requested Quote, and no Account", async () => {
    const res = await submit(guestAsk());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      emailedTo: "casey@example.com",
    });
    // nobody is signed in by submitting
    expect(res.headers["set-cookie"]).toBeUndefined();

    const office = await signInAsOffice();
    const [listed] = (await office.get("/api/quotes")).body;
    expect(listed).toMatchObject({
      id: res.body.id,
      kind: null,
      status: "requested",
      origin: "client",
      client: { name: "Casey Client" },
      property: { street: "41-12 Austin St", unit: "4B" },
      asked: { condition: "moderate", wantsRegularService: true },
      headlineTotalCents: null,
    });
    const quote = (await office.get(`/api/quotes/${listed.id}`).expect(200))
      .body;
    expect(quote).toMatchObject({
      property: { street: "41-12 Austin St", unit: "4B", bathrooms: 1.5 },
      draft: null,
      offer: null,
      revisions: [],
    });
  });

  test("emails a receipt saying where the Quote will go", async () => {
    const { body } = await submit(guestAsk()).expect(201);

    const receipt = testEmail().lastTo("casey@example.com");
    expect(receipt.subject).toBe("We got your request for a quote");
    expect(receipt.text).toContain("41-12 Austin St, 4B, 11375");
    expect(receipt.text).toContain(
      "We'll email your quote to casey@example.com",
    );
    // its only link is to the Quote's page, which never signs anyone in
    // (ADR-0006): it shows the offer once it's Sent
    expect(receipt.text.match(/https?:\/\/\S+/g)).toEqual([
      expect.stringMatching(new RegExp(`/portal/quotes/${body.id}$`)),
    ]);
  });

  test("is connected to the Account when that email signs up later", async () => {
    await submit(guestAsk());

    const agent = await signIn("casey@example.com");
    const me = (await agent.get("/api/clients/me")).body;

    expect(me).toMatchObject({ name: "Casey Client", phone: casey.phone });
    expect(me.properties).toHaveLength(1);
    expect(me.quotes).toHaveLength(1);
  });

  test("with an existing Client's email, joins that Client without changing them", async () => {
    await submit(guestAsk());

    await submit(
      guestAsk({
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
    expect(me.quotes).toHaveLength(2);
    // the real owner hears about it, at their own address
    const receipts = testEmail()
      .to("casey@example.com")
      .filter((m) => m.subject === "We got your request for a quote");
    expect(receipts).toHaveLength(2);
  });

  test("explains what's wrong, field by field, in the API's error format", async () => {
    const res = await submit(
      guestAsk({
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
      guestAsk({
        property: { existing: "00000000-0000-4000-8000-000000000000" },
      }),
    );

    expect(res.status).toBe(400);
  });

  test("is accepted from the landing site", async () => {
    const res = await api()
      .options("/api/quotes/ask")
      .set("Origin", "http://localhost:4321")
      .set("Access-Control-Request-Method", "POST");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:4321",
    );
  });

  test("says where on the landing site it came from, for the Office", async () => {
    const { body } = await submit(
      guestAsk({
        source: {
          page: "/queens/",
          utmSource: "gbp",
          utmMedium: "",
          utmCampaign: null,
        },
      }),
    ).expect(201);

    const office = await signInAsOffice();
    const quote = (await office.get(`/api/quotes/${body.id}`)).body;
    expect(quote.source).toEqual({
      page: "/queens/",
      utmSource: "gbp",
      utmMedium: null,
      utmCampaign: null,
    });
  });

  test("from a page that isn't one, is refused", async () => {
    const res = await submit(
      guestAsk({
        source: {
          page: "https://elsewhere.example/",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
        },
      }),
    );

    expect(res.status).toBe(400);
  });

  test("without a source, has none", async () => {
    const { body } = await submit(guestAsk()).expect(201);

    const office = await signInAsOffice();
    expect((await office.get(`/api/quotes/${body.id}`)).body.source).toBeNull();
  });
});

describe("a signed-in Client asking", () => {
  test("can't say where on the landing site they asked from", async () => {
    await submit(guestAsk({ contact: { ...casey, email: "sam@example.com" } }));
    const agent = await signIn("sam@example.com");
    const { body } = await agent
      .post("/api/quotes/ask")
      .send({
        ...guestAsk(),
        contact: undefined,
        property: { new: { ...home, street: "7 Elm St" } },
        source: { page: "/queens/" },
      })
      .expect(201);

    const office = await signInAsOffice();
    expect((await office.get(`/api/quotes/${body.id}`)).body.source).toBeNull();
  });
});

const ownHomes = async (email: string) =>
  (await (await signIn(email)).get("/api/clients/me")).body;

describe("the Service asked for", () => {
  test("must be named, and on offer for the kind of Property", async () => {
    const { serviceKey: _, ...unnamed } = guestAsk();

    const none = await submit(unnamed);
    const forBusinesses = await submit(
      guestAsk({ serviceKey: SEEDED.commercial }),
    );

    expect(none.status).toBe(400);
    expect(none.body.details).toContainEqual(
      expect.objectContaining({ path: "serviceKey" }),
    );
    expect(forBusinesses.status).toBe(400);
    expect(forBusinesses.body.details).toEqual([
      expect.objectContaining({
        path: "serviceKey",
        issue: "Pick a service from the list",
      }),
    ]);
  });

  test("decides whether a home's Condition is asked: Painting's isn't", async () => {
    const { condition: _, ...unstated } = guestAsk();

    const cleaning = await submit(unstated);
    const painting = await submit(
      guestAsk({
        condition: undefined,
        serviceKey: SEEDED.painting,
        wantsRegularService: false,
        area: 400,
      }),
    ).expect(201);

    expect(cleaning.status).toBe(400);
    expect(cleaning.body.details).toEqual([
      { path: "condition", issue: "Pick how much cleaning the home needs" },
    ]);
    const office = await signInAsOffice();
    const quote = (await office.get(`/api/quotes/${painting.body.id}`)).body;
    expect(quote.asked).toMatchObject({ condition: null, area: 400 });
    expect(quote.property.condition).toBeNull();
  });

  test("asks for regular visits only if it can recur", async () => {
    const { body } = await submit(
      guestAsk({ serviceKey: SEEDED.moveInOut, wantsRegularService: true }),
    ).expect(201);

    const office = await signInAsOffice();
    const quote = (await office.get(`/api/quotes/${body.id}`)).body;
    expect(quote.asked.wantsRegularService).toBe(false);
  });

  test("may be another alongside a Quote open for a different one", async () => {
    await submit(guestAsk()).expect(201);

    const painting = await submit(
      guestAsk({ serviceKey: SEEDED.painting, wantsRegularService: false }),
    );
    // a Deep Clean could become a Service Plan, as the Standard Clean asked
    // for could (a Guest isn't told, #243)
    const { contact: _, ...deepAsk } = guestAsk({ serviceKey: SEEDED.deep });
    const deep = await submit(deepAsk, await signIn(casey.email));

    expect(painting.status).toBe(201);
    expect(deep.status).toBe(409);
  });
});

describe("a home's rooms", () => {
  // the home, as asked about for Painting alone: no rooms
  const {
    bedrooms: _b,
    bathrooms: _ba,
    storeys: _s,
    pets: _p,
    ...roomless
  } = home;
  const painting = { serviceKey: SEEDED.painting, wantsRegularService: false };

  test("aren't asked for a Service priced otherwise, and are for one priced from them", async () => {
    const forPainting = await submit(
      guestAsk({ ...painting, property: { new: roomless } }),
    );
    const forCleaning = await submit(
      guestAsk({
        property: { new: { ...roomless, street: "9 Elm St" } },
      }),
    );

    expect(forPainting.status).toBe(201);
    expect((await ownHomes(casey.email)).properties[0]).toMatchObject({
      bedrooms: null,
      bathrooms: null,
      storeys: null,
      pets: null,
    });
    expect(forCleaning.status).toBe(400);
    expect(
      forCleaning.body.details.map((d: { path: string }) => d.path),
    ).toEqual([
      "property.new.bedrooms",
      "property.new.bathrooms",
      "property.new.storeys",
      "property.new.pets",
    ]);
  });

  test("are given all together, or not at all", async () => {
    const res = await submit(
      guestAsk({
        ...painting,
        property: { new: { ...roomless, bedrooms: 2 } },
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body.details).toContainEqual({
      path: "property.new.bathrooms",
      issue: "Fill in all of the home's rooms, or none",
    });
  });

  test("given by a Guest for a home without them stay on the Quote", async () => {
    await submit(guestAsk({ ...painting, property: { new: roomless } })).expect(
      201,
    );

    // anyone can type the Client's email and address (#243)
    const { body } = await submit(
      guestAsk({ condition: "heavy", property: { new: home } }),
    ).expect(201);

    expect((await ownHomes(casey.email)).properties[0]).toMatchObject({
      bedrooms: null,
      condition: null,
    });
    const office = await signInAsOffice();
    const quote = (await office.get(`/api/quotes/${body.id}`).expect(200)).body;
    expect(quote.asked).toMatchObject({
      condition: "heavy",
      rooms: { bedrooms: 2, bathrooms: 1.5, storeys: 1, pets: true },
    });
  });

  test("are given by a home without them when it's asked about for cleaning", async () => {
    await submit(guestAsk({ ...painting, property: { new: roomless } })).expect(
      201,
    );
    const agent = await signIn(casey.email);
    const [property] = (await ownHomes(casey.email)).properties;

    const without = await submit(
      {
        property: { existing: property.id },
        serviceKey: SEEDED.moveInOut,
        condition: "light",
        wantsRegularService: false,
      },
      agent,
    );
    const rooms = { bedrooms: 3, bathrooms: 2, storeys: 2, pets: false };
    await submit(
      {
        property: { existing: property.id, rooms },
        serviceKey: SEEDED.moveInOut,
        condition: "light",
        wantsRegularService: false,
      },
      agent,
    ).expect(201);

    expect(without.status).toBe(400);
    expect(without.body.details[0].path).toBe("property.rooms.bedrooms");
    expect((await ownHomes(casey.email)).properties[0]).toMatchObject(rooms);
  });
});

describe("one address is one home", () => {
  // a Requested Quote stays open until the Office answers it, so a home is
  // freed for a new ask by removing its Quote here
  const resolveAll = () => db.delete(quotes);

  test.each([
    ["spelled out", "41-12 Austin Street", "Apt 4B"],
    ["with punctuation and capitals", "41-12 AUSTIN ST.", "#4b"],
    ["with the hyphen as a space", "41 12 Austin St", "apartment 4B"],
  ])("the same address %s is the same home", async (_, street, unit) => {
    await submit(guestAsk());
    await resolveAll();

    await submit(
      guestAsk({ property: { new: { ...home, street, unit } } }),
    ).expect(201);

    expect((await ownHomes("casey@example.com")).properties).toHaveLength(1);
  });

  test("a different unit in the same building is a different home", async () => {
    await submit(guestAsk());

    await submit(
      guestAsk({ property: { new: { ...home, unit: "5A" } } }),
    ).expect(201);

    expect((await ownHomes("casey@example.com")).properties).toHaveLength(2);
  });

  test("a home keeps its details when the address is entered again", async () => {
    await submit(guestAsk());
    await resolveAll();

    await submit(
      guestAsk({
        condition: "heavy",
        property: { new: { ...home, bedrooms: 5, pets: false } },
      }),
    ).expect(201);

    const { properties } = await ownHomes("casey@example.com");
    expect(properties).toHaveLength(1);
    // the details stay as first given, and a Guest restates no Condition
    // (#243): what they said is on the Quote
    expect(properties[0]).toMatchObject({
      bedrooms: 2,
      pets: true,
      condition: "moderate",
    });
  });

  test("each Client has their own record of an address", async () => {
    await submit(guestAsk());
    await submit(
      guestAsk({
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

describe("one open Quote per home", () => {
  const refusal =
    "You've already asked us for a quote for this home. We'll email it to casey@example.com soon.";

  test("a Guest asking again about the same home gets the usual reply, and the Client's inbox why", async () => {
    const first = await submit(guestAsk()).expect(201);

    // the reply can't tell anyone which homes have a Quote open (#243)
    const res = await submit(guestAsk());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      emailedTo: "casey@example.com",
    });
    expect(res.body.id).not.toBe(first.body.id);
    // no second receipt, but word of the one already asked for
    const mail = testEmail().to("casey@example.com");
    expect(mail.map((m) => m.subject)).toEqual([
      "We got your request for a quote",
      "About your request for a quote",
    ]);
    expect(mail[1]!.text).toContain(
      "You've already asked us for a quote for 41-12 Austin St, 4B, 11375. We'll email it to casey@example.com soon.",
    );
    expect((await ownHomes("casey@example.com")).quotes).toHaveLength(1);
  });

  test("a Client choosing one of their homes is told the same", async () => {
    await submit(guestAsk());
    const agent = await signIn("casey@example.com");
    const [property] = (await agent.get("/api/clients/me")).body.properties;

    const res = await submit(
      {
        serviceKey: SEEDED.standard,
        property: { existing: property.id },
        condition: "light",
        wantsRegularService: false,
      },
      agent,
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(refusal);
  });

  test("a Client entering the address of a home with a Requested Quote is told the same", async () => {
    await submit(guestAsk());
    const agent = await signIn("casey@example.com");

    const res = await submit(
      {
        serviceKey: SEEDED.standard,
        property: { new: { ...home, street: "41-12 Austin Street" } },
        condition: "light",
        wantsRegularService: false,
      },
      agent,
    );

    expect(res.status).toBe(409);
  });
});

// so a request is seen within the working day the receipt promises, however
// stale the Office's screen
describe("the Office's email", () => {
  test("goes to every active Office Staff member, linking to the Quote", async () => {
    await signInAsOffice();
    await createStaff({
      name: "Dana Desk",
      email: "dana@example.com",
      roles: ["office_staff", "cleaner"],
    });
    await createStaff({
      name: "Cory Cleaner",
      email: "cory@example.com",
      roles: ["cleaner"],
    });

    const { body } = await submit(guestAsk()).expect(201);

    for (const to of ["olive@example.com", "dana@example.com"]) {
      const notice = testEmail().lastTo(to);
      expect(notice.subject).toBe("New quote request from Casey Client");
      expect(notice.text).toContain("41-12 Austin St, 4B, 11375");
      expect(notice.text.match(/https?:\/\/\S+/g)).toEqual([
        expect.stringMatching(new RegExp(`/office/quotes/${body.id}$`)),
      ]);
    }
    expect(testEmail().to("cory@example.com")).toEqual([]);
  });

  test("still reaches the rest when one can't be sent", async () => {
    await signInAsOffice();
    await createStaff({
      name: "Dana Desk",
      email: "dana@example.com",
      roles: ["office_staff"],
    });
    testEmail().failSendingTo("olive@example.com");

    await submit(guestAsk()).expect(201);

    expect(testEmail().lastTo("dana@example.com").subject).toBe(
      "New quote request from Casey Client",
    );
  });

  test("says what was asked for", async () => {
    await signInAsOffice();

    await submit(
      guestAsk({ serviceKey: SEEDED.deep, wantsRegularService: true }),
    ).expect(201);

    expect(testEmail().lastTo("olive@example.com").text).toContain(
      "Deep Clean, with regular visits",
    );
  });
});

describe("the receipt email", () => {
  test("failing to send doesn't lose or fail the request", async () => {
    testEmail().failSending();

    const res = await submit(guestAsk());
    testEmail().sendNormally();

    expect(res.status).toBe(201);
    expect(res.body.emailedTo).toBe("casey@example.com");
    expect((await ownHomes("casey@example.com")).quotes).toHaveLength(1);
  });
});

describe("a signed-in Account connected to no Client", () => {
  test("becomes that Client, with its proven email, connected straight away", async () => {
    const agent = await signIn("casey@example.com");

    const res = await submit(
      { ...guestAsk(), contact: { name: casey.name, phone: casey.phone } },
      agent,
    );

    expect(res.status).toBe(201);
    expect(res.body.emailedTo).toBe("casey@example.com");
    expect((await agent.get("/api/me")).body.roles).toEqual(["client"]);
    expect((await agent.get("/api/clients/me")).body.quotes).toHaveLength(1);
  });

  test("needs a name and phone", async () => {
    const agent = await signIn("casey@example.com");

    const res = await submit({ ...guestAsk(), contact: undefined }, agent);

    expect(res.status).toBe(400);
  });
});

describe("a signed-in Client", () => {
  const asClient = async () => {
    await submit(guestAsk());
    const agent = await signIn("casey@example.com");
    const me = (await agent.get("/api/clients/me")).body;
    return { agent, property: me.properties[0] };
  };

  test("can ask about a new Property", async () => {
    const { agent } = await asClient();

    await submit(
      {
        serviceKey: SEEDED.standard,
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
    // the earlier Quote has been dealt with (see "one address is one home")
    await db.delete(quotes);

    await submit(
      {
        serviceKey: SEEDED.standard,
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
    expect(me.quotes[0]).toMatchObject({
      status: "requested",
      asked: { condition: "heavy", notes: "After a party" },
    });
  });

  test("can't name someone else's Property", async () => {
    const { property } = await asClient();
    const stranger = await signIn("stranger@example.com");
    await submit(
      {
        ...guestAsk(),
        contact: { name: "Sam Stranger", phone: casey.phone },
      },
      stranger,
    );

    const res = await submit(
      {
        serviceKey: SEEDED.standard,
        property: { existing: property.id },
        condition: "light",
        wantsRegularService: false,
      },
      stranger,
    );

    expect(res.status).toBe(404);
  });

  // a new email waits for its link (clients.test.ts)
  test("can edit their contact details", async () => {
    const { agent } = await asClient();

    const res = await agent.patch("/api/clients/me").send({
      ...casey,
      name: "Casey C. Client",
      phone: "(718) 555-0123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Casey C. Client",
      email: casey.email,
      phone: "(718) 555-0123",
    });
  });

  test("can't take another Client's email", async () => {
    const { agent } = await asClient();
    await submit(
      guestAsk({ contact: { ...casey, email: "dana@example.com" } }),
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
      { ...guestAsk(), contact: { name: "Dana Doe", phone: casey.phone } },
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
  test("see open Quotes, newest first", async () => {
    await submit(guestAsk());
    await submit(
      guestAsk({
        contact: { ...casey, name: "Dana Doe", email: "dana@example.com" },
      }),
    );
    const office = await signInAsOffice();

    const listed = (await office.get("/api/quotes")).body;

    expect(
      listed.map((r: { client: { name: string } }) => r.client.name),
    ).toEqual(["Dana Doe", "Casey Client"]);
  });

  test("view a Client with their Properties, each with where it stands", async () => {
    await submit(guestAsk());
    const office = await signInAsOffice();
    const [request] = (await office.get("/api/quotes")).body;

    const client = (await office.get(`/api/clients/${request.client.id}`)).body;

    expect(client).toMatchObject({
      name: "Casey Client",
      email: "casey@example.com",
    });
    expect(client.properties).toEqual([
      expect.objectContaining({
        id: request.property.id,
        status: { kind: "quote_requested" },
        // for the form, so a caller's ask can tell what it may be for
        openQuotes: [
          {
            propertyId: request.property.id,
            serviceKey: SEEDED.standard,
            kind: null,
          },
        ],
      }),
    ]);
  });

  test("view a Property with its Quotes", async () => {
    await submit(guestAsk());
    const office = await signInAsOffice();
    const [request] = (await office.get("/api/quotes")).body;

    const property = (
      await office.get(`/api/properties/${request.property.id}`).expect(200)
    ).body;

    expect(property).toMatchObject({
      street: "41-12 Austin St",
      client: { id: request.client.id, name: "Casey Client" },
      firstCleanCompleted: false,
      jobs: [],
    });
    expect(property.quotes.map((r: { id: string }) => r.id)).toEqual([
      request.id,
    ]);
  });

  test("correct any of a Property's details, but not its address", async () => {
    await submit(guestAsk());
    const office = await signInAsOffice();
    const [request] = (await office.get("/api/quotes")).body;

    await office
      .patch(`/api/properties/${request.property.id}`)
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
    await submit(guestAsk());
    const office = await signInAsOffice();
    const [request] = (await office.get("/api/quotes")).body;

    const res = await office
      .patch(`/api/properties/${request.property.id}`)
      .send({ bathrooms: 1.25 });

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatchObject({
      path: "bathrooms",
      issue: "Use whole or half bathrooms, like 1.5",
    });
  });

  test("are the only ones who see the list", async () => {
    await submit(guestAsk());
    const agent = await signIn("casey@example.com");

    expect((await agent.get("/api/quotes")).status).toBe(403);
    expect((await api().get("/api/quotes")).status).toBe(401);
  });
});
