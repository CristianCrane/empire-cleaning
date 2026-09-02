import type { RequestHandler } from "express";
import { z } from "zod";

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
  (req, res, next) => {
    if (paramsSchema) {
      const result = paramsSchema.safeParse(req.params);
      if (!result.success) {
        res.json(z.treeifyError(result.error)).status(400);
        return;
      }
    }

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        res.json(z.treeifyError(result.error)).status(400);
        return;
      }
    }

    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) {
        res.json(z.treeifyError(result.error)).status(400);
        return;
      }
    }

    next();
  };
