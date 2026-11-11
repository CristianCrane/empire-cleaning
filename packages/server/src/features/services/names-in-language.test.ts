import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  ClientJobDetail,
  ClientView,
  ClientPayment,
  ClientUpcomingJob,
  CleanerJobs,
  QuoteSummary,
  QuoteView,
} from "@empire-cleaning/models";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import { clients } from "#features/clients";
import { completeJob } from "#features/completion";
import { currentPriceList } from "#features/price-list";
import { createStaff, setUsualWeek } from "#features/staff";
import {
  signIn,
  testClock,
  testEmail,
  type Agent,
} from "../../../tests/harness.ts";
import {
  acceptedJob,
  addPremises,
  casey,
  signInAsOffice,
} from "../../../tests/fixtures.ts";

// What the Office names in both languages, a Service and its extras, and a
// card, as each
// reader reads it (ADR-0025, #395): a Client or Cleaner reading Spanish sees
// the Spanish names on every screen and in every email, the Office the
// English, and nothing Spanish is stored

const inSpanish = (agent: Agent, path: string) =>
  agent.get(path).set("Accept-Language", "es").expect(200);

// Casey's Deep Clean with the oven done, booked by the Office, Cory on it
const booked = async () => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as { id: string };
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  const job = await acceptedJob({
    startsAt: "2026-01-12T14:00:00Z",
    byAccountId: me.id,
    addOns: ["Inside the oven"],
  });
  const offered = await offerAssignment(job.id, cory.id, me.id);
  await confirmAssignment(cory.id, offered.assignments[0]!.id);
  return { office, cory, job };
};

describe("names the Office gives in both languages", () => {
  test("a Spanish-reading Client sees the Spanish on their Quote, Job and payments, the Office the English", async () => {
    const { office, job } = await booked();
    const client = await signIn(casey.email);

    const [summary] = (await inSpanish(client, "/api/quotes/mine"))
      .body as QuoteSummary[];
    // the Deep Clean it recommends for a first visit leads
    expect(summary!.headlineServiceName).toBe("Limpieza profunda");
    expect(summary!.asked!.service.name).toBe("Limpieza estándar");
    expect(summary!.asked!.addOns.map((a) => a.name)).toEqual([
      "Dentro del horno",
    ]);
    const quote = (await inSpanish(client, `/api/quotes/mine/${summary!.id}`))
      .body as QuoteView;
    expect(quote.options.map((o) => o.serviceName)).toEqual([
      "Limpieza profunda",
      "Limpieza estándar",
    ]);
    expect(quote.options[0]!.addOns.map((a) => a.name)).toEqual([
      "Dentro del horno",
    ]);

    const [upcoming] = (await inSpanish(client, "/api/jobs/mine"))
      .body as ClientUpcomingJob[];
    expect(upcoming!.serviceName).toBe("Limpieza profunda");
    const detail = (await inSpanish(client, `/api/jobs/mine/${job.id}`))
      .body as ClientJobDetail;
    expect(detail.addOns).toEqual(["Dentro del horno"]);
    // the card it's paid with, by its brand and last 4
    expect(detail.payment.paymentMethod).toBe("Test card terminada en 4242");
    const card = (await inSpanish(client, "/api/payment-methods/mine"))
      .body as {
      label: string;
    };
    expect(card.label).toBe("Test card terminada en 4242");
    const [deposit] = (await inSpanish(client, "/api/payments/mine"))
      .body as ClientPayment[];
    expect(deposit!.job!.serviceName).toBe("Limpieza profunda");

    // a business's type, by the Price List's Spanish
    await addPremises((await inSpanish(client, "/api/clients/me")).body.id);
    const me = (await inSpanish(client, "/api/clients/me")).body as ClientView;
    const premises = me.properties.find((p) => p.kind === "commercial")!;
    expect(premises.kind === "commercial" && premises.premisesType.name).toBe(
      "Oficina",
    );

    // the same records, as the Office reads them
    const office$ = (await office.get(`/api/quotes/${summary!.id}`).expect(200))
      .body as { offer: { options: { serviceName: string }[] } };
    expect(office$.offer.options.map((o) => o.serviceName)).toEqual([
      "Deep Clean",
      "Standard Clean",
    ]);
    const english = (await client.get(`/api/jobs/mine/${job.id}`).expect(200))
      .body as ClientJobDetail;
    expect(english.serviceName).toBe("Deep Clean");
    expect(english.addOns).toEqual(["Inside the oven"]);
    expect(english.payment.paymentMethod).toBe("Test card ending 4242");
  });

  test("a Spanish-reading Cleaner sees the Job's extras and the ones to report in Spanish, and the Client the price change", async () => {
    const { cory, job } = await booked();
    const cleaner = await signIn("cory@example.com");

    const { today, upcoming } = (
      await inSpanish(cleaner, "/api/assignments/mine")
    ).body as CleanerJobs;
    const [mine] = [...today, ...upcoming];
    expect(mine!.serviceName).toBe("Limpieza profunda");
    expect(mine!.addOns).toEqual(["Dentro del horno"]);
    expect(mine!.reportable.quoted.map((a) => a.name)).toEqual([
      "Dentro del horno",
    ]);
    expect(mine!.reportable.others.map((a) => a.name)).toEqual(
      expect.arrayContaining(["Dentro del refrigerador"]),
    );

    const list = await currentPriceList();
    const oven = list.addOns.find((a) => a.name === "Inside the oven")!;
    await db
      .update(clients)
      .set({ preferredLanguage: "es" })
      .where(eq(clients.email, casey.email));
    testClock().set(new Date("2026-01-12T16:00:00Z"));
    await completeJob(cory.id, job.id, {
      condition: "moderate",
      reports: [
        { kind: "add_on_not_done", addOnKey: oven.key, reason: "Sin gas" },
      ],
    });

    // the receipt, in Spanish from its Service to its price change
    const receipt = testEmail().lastTo(casey.email);
    expect(receipt.text).toContain("Limpieza profunda");
    expect(receipt.text).toContain("Dentro del horno, no se hizo");
    expect(receipt.text).not.toContain("Deep Clean");
    expect(receipt.text).not.toContain("Inside the oven");

    const client = await signIn(casey.email);
    const detail = (await inSpanish(client, `/api/jobs/mine/${job.id}`))
      .body as ClientJobDetail;
    expect(detail.completion!.adjustments.map((a) => a.addOnName)).toEqual([
      "Dentro del horno",
    ]);
  });
});
