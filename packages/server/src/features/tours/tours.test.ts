import { describe, expect, test } from "vitest";
import { api, signIn } from "../../../tests/harness.ts";

const seenTours = async (agent: Awaited<ReturnType<typeof signIn>>) =>
  (await agent.get("/api/me").expect(200)).body.seenTours;

describe("first-time help tours seen", () => {
  test("a new Account has seen none", async () => {
    expect(await seenTours(await signIn("casey@example.com"))).toEqual([]);
  });

  test("a tour marked seen stays seen, once, wherever they sign in", async () => {
    const phone = await signIn("casey@example.com");
    await phone.put("/api/me/tours/portal-home").expect(204);
    await phone.put("/api/me/tours/portal-quote").expect(204);
    await phone.put("/api/me/tours/portal-home").expect(204);

    const laptop = await signIn("casey@example.com");
    expect(await seenTours(laptop)).toEqual(["portal-home", "portal-quote"]);
  });

  test("each Account has its own", async () => {
    const casey = await signIn("casey@example.com");
    await casey.put("/api/me/tours/portal-home").expect(204);

    expect(await seenTours(await signIn("olive@example.com"))).toEqual([]);
  });

  test("Show tips again forgets them all, only for that Account", async () => {
    const casey = await signIn("casey@example.com");
    const olive = await signIn("olive@example.com");
    await casey.put("/api/me/tours/portal-home").expect(204);
    await olive.put("/api/me/tours/office-today").expect(204);

    await casey.delete("/api/me/tours").expect(204);

    expect(await seenTours(casey)).toEqual([]);
    expect(await seenTours(olive)).toEqual(["office-today"]);
  });

  test("a tour's name is a short slug", async () => {
    const casey = await signIn("casey@example.com");
    await casey.put("/api/me/tours/Portal_Home").expect(400);
    await casey.put(`/api/me/tours/${"a".repeat(41)}`).expect(400);

    expect(await seenTours(casey)).toEqual([]);
  });

  test("Guests have none to mark or forget", async () => {
    await api().put("/api/me/tours/portal-home").expect(401);
    await api().delete("/api/me/tours").expect(401);
  });
});
