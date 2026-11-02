import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestHandler } from "express";
import { pinoHttp } from "pino-http";
import { log, scrubText, withRequest } from "#services/monitoring";

// one line per request, and a request ID on every line logged while serving
// it and on every Sentry event (ADR-0007): the caller's when it sends one, so
// the host's logs and ours match up
const requestLogger = pinoHttp({
  logger: log,
  genReqId: (req) => {
    const given = req.headers["x-request-id"];
    return typeof given === "string" && given ? given : randomUUID();
  },
  // the uptime monitor and Render's health check call it all day
  autoLogging: { ignore: (req) => req.url === "/health" },
  customLogLevel: (_req, res, error) =>
    error || res.statusCode >= 500 ? "error" : "info",
  // what was asked and how it went; never headers, bodies or the query's
  // values
  wrapSerializers: false,
  serializers: {
    req: (req: IncomingMessage) => ({
      method: req.method,
      url: scrubText(req.url ?? ""),
    }),
    res: (res: ServerResponse) => ({ status: res.statusCode }),
  },
  // the request ID is on every line already
  quietReqLogger: true,
  customAttributeKeys: { reqId: "requestId" },
});

export const networkLoggingMiddleware: RequestHandler = (req, res, next) => {
  requestLogger(req, res);
  withRequest(String(req.id), next);
};
