import { describe, expect, test } from "vitest";
import { auth } from "#features/auth";
import {
  api,
  limitedAs,
  signIn,
  testClock,
  testEmail,
} from "../../../tests/harness.ts";
import {
  casey,
  guestAsk,
  home,
  signInAsOffice,
  submit,
} from "../../../tests/fixtures.ts";
import { inboxOf } from "./index.ts";

const askForLink = (address: string) =>
  api()
    .post("/api/auth/sign-in/magic-link")
    .send({ email: address, callbackURL: "/" });

// a Guest's ask about a home of its own, so none waits on another's Quote
let homes = 0;
const askAboutNewHome = (email = casey.email) =>
  submit(
    guestAsk({
      contact: { ...casey, email },
      property: { new: { ...home, unit: `${++homes}A` } },
    }),
  );

describe("sign-in links (#32)", () => {
  test("an address gets six in 15 minutes, then is told how long to wait", async () => {
    limitedAs("prod");
    for (let i = 0; i < 6; i++) {
      await askForLink("casey@example.com").expect(200);
    }

    const refused = await askForLink("casey@example.com");

    expect(refused.status).toBe(429);
    expect(refused.headers["retry-after"]).toBe("900");
    expect(refused.body.message).toBe(
      "Too many tries. Please try again in 15 minutes, or call us on (646) 320-9076.",
    );
    expect(testEmail().to("casey@example.com")).toHaveLength(6);

    testClock().advance({ minutes: 15 });
    await askForLink("casey@example.com").expect(200);
  });

  test("the wait ends when the oldest link leaves the 15 minutes", async () => {
    limitedAs("prod");
    await askForLink("casey@example.com").expect(200);
    testClock().advance({ minutes: 10 });
    for (let i = 0; i < 5; i++) {
      await askForLink("casey@example.com").expect(200);
    }

    const refused = await askForLink("casey@example.com").expect(429);

    expect(refused.headers["retry-after"]).toBe("300");
    expect(refused.body.message).toContain("try again in 5 minutes");
  });

  test("one inbox is one count, however its address is written", async () => {
    limitedAs("prod");
    await askForLink("Big.Name+one@Gmail.com").expect(200);
    await askForLink("bigname@gmail.com").expect(200);
    await askForLink("big.name+two@googlemail.com").expect(200);
    await askForLink("BigName@gmail.com").expect(200);
    await askForLink("b.i.g.n.a.m.e@gmail.com").expect(200);
    await askForLink("bigname+three@gmail.com").expect(200);

    await askForLink("bi.gname@gmail.com").expect(429);
  });

  test("another address isn't held up", async () => {
    limitedAs("prod");
    for (let i = 0; i < 6; i++) await askForLink("casey@example.com");
    await askForLink("casey@example.com").expect(429);

    await askForLink("robin@example.com").expect(200);
  });

  test.each(["dev", "test"] as const)("%s has no limit", async (mode) => {
    limitedAs(mode);
    for (let i = 0; i < 10; i++) {
      await askForLink("casey@example.com").expect(200);
    }
  });

  test("Better Auth's own limits stay off, whatever NODE_ENV says", () => {
    // they count per network address, which behind Render it can't tell apart
    expect(auth.options.rateLimit?.enabled).toBe(false);
  });
});

describe("Guest Quote Requests (#32)", () => {
  test("an address gets six a day; a seventh saves and sends nothing", async () => {
    limitedAs("prod");
    for (let i = 0; i < 6; i++) await askAboutNewHome().expect(201);

    const refused = await askAboutNewHome();

    expect(refused.status).toBe(429);
    expect(refused.headers["retry-after"]).toBe(String(24 * 60 * 60));
    expect(refused.body.message).toBe(
      "Too many tries. Please try again in 24 hours, or call us on (646) 320-9076.",
    );
    expect(testEmail().to(casey.email)).toHaveLength(6);
    const office = await signInAsOffice();
    expect((await office.get("/api/quotes")).body).toHaveLength(6);

    testClock().advance({ days: 1 });
    await askAboutNewHome().expect(201);
  });

  test("another address isn't held up", async () => {
    limitedAs("prod");
    for (let i = 0; i < 6; i++) await askAboutNewHome();
    await askAboutNewHome().expect(429);

    await askAboutNewHome("robin@example.com").expect(201);
  });

  test("the test site has no limit", async () => {
    limitedAs("test");
    for (let i = 0; i < 10; i++) await askAboutNewHome().expect(201);
  });

  test("a signed-in Client's aren't limited: they go to their own inbox", async () => {
    await askAboutNewHome().expect(201);
    const agent = await signIn(casey.email);
    limitedAs("prod");

    for (let i = 0; i < 7; i++) {
      await submit(
        {
          ...guestAsk({ property: { new: { ...home, unit: `${++homes}A` } } }),
          contact: undefined,
        },
        agent,
      ).expect(201);
    }
  });
});

describe("the Quote form's hidden field (#32)", () => {
  test("filled, the ask is answered as done, but nothing is saved or sent", async () => {
    const res = await submit({
      ...guestAsk(),
      website: "https://spam.example",
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      emailedTo: casey.email,
    });
    expect(testEmail().sent).toHaveLength(0);
    const office = await signInAsOffice();
    expect((await office.get("/api/quotes")).body).toHaveLength(0);
  });

  test("filled, even a broken ask is answered as done", async () => {
    await submit({ website: "x", nonsense: true }).expect(201);
  });

  test("left empty, the ask goes ahead", async () => {
    await submit({ ...guestAsk(), website: "" }).expect(201);

    expect(testEmail().to(casey.email)).toHaveLength(1);
  });
});

test("an inbox is the same however its address is written", () => {
  expect(inboxOf(" Casey.Client+quotes@Example.com ")).toBe(
    "casey.client@example.com",
  );
  expect(inboxOf("Casey.Client+x@googlemail.com")).toBe(
    "caseyclient@gmail.com",
  );
});
