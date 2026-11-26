import { catalog } from "@empire-cleaning/models";
import type { ErrorRequestHandler } from "express";
import { z, type ZodError } from "zod";
import { monitoring } from "#services/monitoring";
import { currentLanguage } from "#services/request";
import env from "../env.ts";

type StatusCode = 400 | 401 | 403 | 404 | 409 | 429 | 500;

export class APIError extends Error {
  public readonly statusCode: StatusCode;

  constructor(message: string, statusCode: StatusCode = 500) {
    super(message);
    this.statusCode = statusCode;

    // restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // set proper error class name in stack traces
    this.name = this.constructor.name;

    // capture clean stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

type APIErrorDetail = {
  path: string;
  issue: string;
  value: unknown;
};

export class PathParameterError extends APIError {
  public readonly details: APIErrorDetail[];
  constructor(zodError: ZodError) {
    super("Invalid path parameter", 400);
    this.details = zodError.issues.map((issue) => ({
      path: issue.path.join("."),
      issue: issue.message,
      value: issue.input,
    }));
  }
}

export class RequestBodyError extends APIError {
  public readonly details: APIErrorDetail[];
  constructor(zodError: ZodError) {
    super("Invalid request body", 400);
    this.details = zodError.issues.map((issue) => ({
      path: issue.path.join("."),
      issue: issue.message,
      value: issue.input,
    }));
  }
}

// a request refused over one field, whose message shows beside it
export const fieldError = (
  path: (string | number)[],
  message: string,
  input?: unknown,
) =>
  new RequestBodyError(
    new z.ZodError([{ code: "custom", path, message, input }]),
  );

export class QueryParameterError extends APIError {
  public readonly details: APIErrorDetail[];
  constructor(zodError: ZodError) {
    super("Invalid query parameter", 400);
    this.details = zodError.issues.map((issue) => ({
      path: issue.path.join("."),
      issue: issue.message,
      value: issue.input,
    }));
  }
}

export class RuntimeValidationError extends APIError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends APIError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends APIError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = "Not found") {
    super(message, 404);
  }
}

// the request is fine but clashes with what already exists, e.g. a Quote
// Request for a home that already has one waiting. A `kind` tells a screen
// what sort of clash it is where its words alone can't: "approve", a
// payment that's the Client's to approve at their bank, whether the Office
// asked for it (accept.ts) or they turned it down there on a Bill's or a
// Job's page (bills.ts, completion.ts) (#534 Q7): theirs to do, not a
// failure
export class ConflictError extends APIError {
  public readonly kind?: "approve";
  constructor(message: string, kind?: "approve") {
    super(message, 409);
    this.kind = kind;
  }
}

// what a 409 says when what the change was made from has changed while
// the person looked, such as the cost of cancelling: the page reloads to
// show it. In the request's language (ADR-0025)
const changedWords = catalog({
  en: {
    CHANGED_SINCE:
      "Something changed just then. Please check it and try again.",
  },
  es: {
    CHANGED_SINCE:
      "Algo cambió en este momento. Revíselo y vuelva a intentarlo.",
  },
});
export const changedSince = () => changedWords[currentLanguage()].CHANGED_SINCE;

// tried too often for now (#32): says how long to wait, also in Retry-After
export class TooManyRequestsError extends APIError {
  public readonly retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number) {
    super(message, 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type APIErrorResponse = {
  message: string;
  details?: APIErrorDetail[];
  kind?: ConflictError["kind"];
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let statusCode = 500;
  const errResponse: APIErrorResponse = {
    message: "Internal Server Error",
  };

  if (err instanceof APIError) {
    statusCode = err.statusCode;
    errResponse.message = err.message;

    if (
      err instanceof PathParameterError ||
      err instanceof RequestBodyError ||
      err instanceof QueryParameterError
    ) {
      errResponse.details = err.details;
    }
    if (err instanceof ConflictError && err.kind) {
      errResponse.kind = err.kind;
    }
    if (err instanceof TooManyRequestsError) {
      res.set("Retry-After", String(err.retryAfterSeconds));
    }
  } else if (env.APP_MODE !== "prod") {
    // only show unexpected error messages in lower environments
    errResponse.message = err.message;
  }

  // 4xx are normal business, in the request log only (ADR-0007)
  if (statusCode >= 500) {
    monitoring.error(err, {
      method: req.method,
      // holds IDs at most; never the query
      path: req.path,
    });
  }

  return res.status(statusCode).json(errResponse);
};
