import type { RequestHandler } from "express";
import { z } from "zod";
import {
  PathParameterError,
  QueryParameterError,
  RequestBodyError,
} from "./errors.ts";

type ValidationMiddlewareOptions<TParamsSchema, TBodySchema, TQuerySchema> = {
  params?: TParamsSchema;
  body?: TBodySchema;
  query?: TQuerySchema;
};

// checks a request's params, body and query against their schemas, and hands
// the handlers after it what each schema made of them (numbers, trimmed
// strings), typed so: they read req.params, req.body and req.query, never
// parse them again
export const validate =
  <TParams, TBody, TQuery>({
    params: paramsSchema,
    body: bodySchema,
    query: querySchema,
  }: ValidationMiddlewareOptions<
    z.ZodSchema<TParams>,
    z.ZodSchema<TBody>,
    z.ZodSchema<TQuery>
  >): RequestHandler<TParams, unknown, TBody, TQuery> =>
  (req, _res, next) => {
    if (paramsSchema) {
      const result = paramsSchema.safeParse(req.params);
      if (!result.success) {
        throw new PathParameterError(result.error);
      }
      req.params = result.data;
    }

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        throw new RequestBodyError(result.error);
      }
      req.body = result.data;
    }

    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) {
        throw new QueryParameterError(result.error);
      }
      // Express 5's req.query is a getter that parses the URL afresh each
      // time: this one on the request hides it, writable and configurable
      // as a plain property is, so another validate can set it again
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };

// what a too-long text field says: "Keep the reason under 500 characters"
export const keepUnder = (max: number, what = "it") =>
  `Keep ${what} under ${max.toLocaleString("en-US")} characters`;

// a day and a start time a person picks, New York
export const day = z.iso.date("Pick a day");
export const startTime = z
  .string({ error: "Pick a start time" })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a start time");
