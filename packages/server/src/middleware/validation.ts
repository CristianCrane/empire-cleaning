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
    }

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        throw new RequestBodyError(result.error);
      }
      // handlers see the parsed body, e.g. trimmed strings
      req.body = result.data;
    }

    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) {
        throw new QueryParameterError(result.error);
      }
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
