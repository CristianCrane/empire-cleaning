import { describe, expect, test } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { errorHandler } from "./errors.ts";
import { validate } from "./validation.ts";

describe("validate()", () => {
  // a stand-in endpoint whose schemas change what they read: a number from
  // the path and the query, a trimmed string
  const params = z.object({ n: z.coerce.number().int() });
  const query = z.object({
    page: z.coerce.number().int(),
    q: z.string().trim(),
  });
  const app = express();
  app.get("/things/:n", validate({ params, query }), (req, res) => {
    res.json({ params: req.params, query: req.query });
  });
  // a second check on the same route sees the first's output
  app.get(
    "/twice/:n",
    validate({ params, query }),
    validate({ params, query }),
    (req, res) => {
      res.json({ params: req.params, query: req.query });
    },
  );
  app.use(errorHandler);

  test("hands the handler the parsed params and query", async () => {
    const { body } = await request(app)
      .get("/things/3?page=2&q=%20mop%20")
      .expect(200);

    expect(body).toEqual({ params: { n: 3 }, query: { page: 2, q: "mop" } });
  });

  test("can check a route twice", async () => {
    const { body } = await request(app)
      .get("/twice/3?page=2&q=mop")
      .expect(200);

    expect(body).toEqual({ params: { n: 3 }, query: { page: 2, q: "mop" } });
  });

  test("turns down a query that doesn't parse", async () => {
    const { body } = await request(app)
      .get("/things/3?page=two&q=")
      .expect(400);

    expect(body.message).toBe("Invalid query parameter");
  });
});
