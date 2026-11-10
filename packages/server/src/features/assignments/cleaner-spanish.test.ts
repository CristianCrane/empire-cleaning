import { describe, expect, test } from "vitest";
import type { CleanerJob } from "@empire-cleaning/models";
import { createStaff, setUsualWeek } from "#features/staff";
import { type Agent, signIn, testClock } from "../../../tests/harness.ts";
import { bookedJob, signInAsOffice } from "../../../tests/fixtures.ts";

// A Cleaner whose screen is in Spanish (ADR-0025, #305): the API's messages
// to them come in it, tú, and in English to a request that names no
// language. The clock starts at 4am on Monday 5 January 2026 in New York;
// the Job is at 9am on Monday the 12th

const MONDAY_9AM = "2026-01-12T14:00:00Z";

type Method = "get" | "post";
// a request from a screen showing Spanish
const es = (agent: Agent, method: Method, path: string) =>
  agent[method](path).set("Accept-Language", "es");

const issues = (body: { details: { path: string; issue: string }[] }) =>
  Object.fromEntries(body.details.map((d) => [d.path, d.issue]));

const coryOnAJob = async () => {
  const office = await signInAsOffice();
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  const job = (await bookedJob({
    startsAt: MONDAY_9AM,
    labourHours: 3,
    crewSize: 1,
  })) as { id: string };
  return { office, cory, agent: await signIn(cory.email), jobId: job.id };
};

describe("a Cleaner reading in Spanish", () => {
  test("is told in Spanish why they can't take, confirm or leave a job", async () => {
    const { office, cory, agent, jobId } = await coryOnAJob();

    // open to Cleaners only from 7 days before
    const early = await es(
      agent,
      "post",
      `/api/assignments/open/${jobId}/confirm`,
    )
      .send({ startsAt: MONDAY_9AM })
      .expect(409);
    expect(early.body.message).toBe(
      "Este trabajo todavía no está disponible. Vuelve a revisar más tarde.",
    );

    await office
      .post(`/api/jobs/${jobId}/assignments`)
      .send({ staffId: cory.id })
      .expect(201);
    const mine = (await agent.get(`/api/assignments/mine/${jobId}`))
      .body as CleanerJob;

    // shown another time than the Job's
    const moved = await es(
      agent,
      "post",
      `/api/assignments/${mine.assignment.id}/confirm`,
    )
      .send({ startsAt: "2026-01-12T15:00:00Z" })
      .expect(409);
    expect(moved.body.message).toBe(
      "Este trabajo cambió al lunes, 12 de enero, 9:00 a.m. Revisa la nueva hora y vuelve a confirmar.",
    );

    await agent
      .post(`/api/assignments/${mine.assignment.id}/confirm`)
      .send({ startsAt: MONDAY_9AM })
      .expect(200);

    // less than 48 hours before
    testClock().set(new Date("2026-01-11T14:00:00Z"));
    const late = await es(
      agent,
      "post",
      `/api/assignments/${mine.assignment.id}/release`,
    ).expect(409);
    expect(late.body.message).toBe(
      "Faltan menos de 48 horas para este trabajo, así que no puedes dejarlo desde aquí. Llama a la oficina, por favor.",
    );
  });

  test("is told in Spanish what's wrong with marking it done, or saying they couldn't get in", async () => {
    const { office, cory, agent, jobId } = await coryOnAJob();
    await office
      .post(`/api/jobs/${jobId}/assignments`)
      .send({ staffId: cory.id })
      .expect(201);
    const complete = `/api/assignments/mine/${jobId}/complete`;
    const noAccess = `/api/assignments/mine/${jobId}/no-access`;

    // Offered, not yet Confirmed
    const offered = await es(agent, "post", complete)
      .send({ condition: "light", reports: [] })
      .expect(409);
    expect(offered.body.message).toBe("Primero confirma este trabajo.");
    const mine = (await agent.get(`/api/assignments/mine/${jobId}`))
      .body as CleanerJob;
    await agent
      .post(`/api/assignments/${mine.assignment.id}/confirm`)
      .send({ startsAt: MONDAY_9AM })
      .expect(200);

    // saying they couldn't get in before it starts: a bookedJob has no Quote
    // to mark it done from
    const early = await es(agent, "post", noAccess)
      .send({ reason: "Nobody answered" })
      .expect(409);
    expect(early.body.message).toBe("Este trabajo todavía no empezó.");

    testClock().set(new Date("2026-01-12T16:00:00Z"));
    const wrong = await es(agent, "post", complete)
      .send({
        condition: "spotless",
        reports: [{ kind: "extra_time", hours: 0.1, reason: "" }],
      })
      .expect(400);
    expect(issues(wrong.body)).toEqual({
      condition: "Di cómo estaba la casa",
      "reports.0.hours": "Usa cuartos de hora, como 1.25",
      "reports.0.reason": "Di por qué",
    });

    const unsaid = await es(agent, "post", noAccess)
      .send({ reason: " " })
      .expect(400);
    expect(issues(unsaid.body)).toEqual({ reason: "Cuenta qué pasó" });
    const tooLong = await es(agent, "post", noAccess)
      .send({ reason: "x".repeat(501) })
      .expect(400);
    expect(issues(tooLong.body)).toEqual({
      reason: "Debe tener menos de 500 caracteres",
    });

    // and in English to a request that names no language
    const english = await agent
      .post(noAccess)
      .send({ reason: " " })
      .expect(400);
    expect(issues(english.body)).toEqual({ reason: "Say what happened" });
  });
});
