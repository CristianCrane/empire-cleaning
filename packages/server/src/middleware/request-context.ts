import type { RequestHandler } from "express";
import { withRequest } from "#services/request";

// the rest of the request runs knowing which request it is (#services/request):
// the ID the request log gave it (logging.ts, which runs first)
export const requestContextMiddleware: RequestHandler = (req, _res, next) => {
  withRequest({ requestId: String(req.id) }, next);
};
