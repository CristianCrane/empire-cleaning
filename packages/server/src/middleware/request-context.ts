import type { RequestHandler } from "express";
import { languageOf } from "@empire-cleaning/models";
import { withRequest } from "#services/request";

// the rest of the request runs knowing which request it is (#services/request):
// the ID the request log gave it (logging.ts, which runs first), and the
// language its screen is showing, which our screens always say
// (Accept-Language: "en" or "es"; English when it names none). Every reply
// may differ by it, so caches are told
export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  res.vary("Accept-Language");
  withRequest(
    {
      requestId: String(req.id),
      language: languageOf(req.get("accept-language")),
    },
    next,
  );
};
