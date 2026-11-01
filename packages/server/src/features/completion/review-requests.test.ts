import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import type {
  OfficeClientView,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "#db";
import { clients } from "#features/clients";
import { sendDueReviewRequests, undoCompletion } from "#features/completion";
import { jobs } from "#features/jobs";
import { testClock, testEmail } from "../../../tests/harness.ts";
import {
  casey,
  completedFirstClean,
  signInAsOffice,
  startedServicePlan,
} from "../../../tests/fixtures.ts";

const REVIEW_URL = "https://search.google.com/local/writereview?placeid=test";

// completedFirstClean() completes Casey's Deep Clean at 11am on Monday 12
// January 2026 in New York
const firstClean = async () => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  return { office, me, ...(await completedFirstClean({ byAccountId: me.id })) };
};

const requests = () =>
  testEmail()
    .to(casey.email)
    .filter((m) => m.subject === "How was your clean?");

const at = (instant: string) => testClock().set(new Date(instant));

const caseyRow = async () =>
  (await db.select().from(clients).where(eq(clients.email, casey.email)))[0]!;

describe("asking a Client for a Google review", () => {
  test("goes from 10am New York on the day after their first Completed Job, once", async () => {
    await firstClean();
    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(0);

    // Tuesday 13 January, 9:59am in New York
    at("2026-01-13T14:59:00Z");
    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(0);

    at("2026-01-13T15:00:00Z");
    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(1);
    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(0);

    const [request] = requests();
    expect(request!.text).toContain("Hi Casey");
    expect(request!.text).toContain(REVIEW_URL);
  });

  test("isn't sent without a review link", async () => {
    await firstClean();
    at("2026-01-13T15:00:00Z");

    expect(await sendDueReviewRequests(undefined)).toBe(0);
    expect(requests()).toEqual([]);
  });

  test("isn't sent to a Client with no email", async () => {
    await firstClean();
    await db
      .update(clients)
      .set({ email: null })
      .where(eq(clients.email, casey.email));
    at("2026-01-13T15:00:00Z");

    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(0);
  });

  test("isn't sent for a completion that was undone", async () => {
    const { job } = await firstClean();
    await undoCompletion(job.id);
    at("2026-01-13T15:00:00Z");

    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(0);
  });

  test("is never sent again, however many cleans follow", async () => {
    const { me, propertyId } = await firstClean();
    const { firstJob } = await startedServicePlan({
      propertyId,
      byAccountId: me.id,
      startsAt: "2026-01-19T14:00:00.000Z",
    });
    at("2026-01-13T15:00:00Z");
    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(1);

    // the plan's first clean done on Monday 19 January
    await db
      .update(jobs)
      .set({
        status: "completed",
        completedAt: new Date("2026-01-19T16:00:00Z"),
      })
      .where(eq(jobs.id, firstJob.id));
    at("2026-01-20T15:00:00Z");

    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(0);
    expect(requests()).toHaveLength(1);
  });

  test("goes by the first Completed Job, not a later one: a Client served before requests began isn't asked", async () => {
    const { me, propertyId } = await firstClean();
    const { firstJob } = await startedServicePlan({
      propertyId,
      byAccountId: me.id,
      startsAt: "2026-01-26T14:00:00.000Z",
    });
    await db
      .update(jobs)
      .set({
        status: "completed",
        completedAt: new Date("2026-01-26T16:00:00Z"),
      })
      .where(eq(jobs.id, firstJob.id));

    // two weeks after the First Clean, a day after the plan's first
    at("2026-01-27T15:00:00Z");
    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(0);
  });

  test("is tried again next time if the email can't go", async () => {
    await firstClean();
    at("2026-01-13T15:00:00Z");
    testEmail().failSending();

    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(0);
    expect((await caseyRow()).reviewRequestedAt).toBeNull();

    testEmail().sendNormally();
    expect(await sendDueReviewRequests(REVIEW_URL)).toBe(1);
  });

  test("shows on the Client's page for the Office", async () => {
    const { office } = await firstClean();
    const { id } = await caseyRow();
    const view = async () =>
      (await office.get(`/api/clients/${id}`).expect(200))
        .body as OfficeClientView;
    expect((await view()).reviewRequestedAt).toBeNull();

    at("2026-01-13T15:00:00Z");
    await sendDueReviewRequests(REVIEW_URL);

    expect((await view()).reviewRequestedAt).toBe("2026-01-13T15:00:00.000Z");
  });
});
