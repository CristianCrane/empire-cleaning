import type { ErrorRequestHandler } from "express";
import type { ZodError } from "zod";
import env from "../env.ts";

type StatusCode = 400 | 401 | 403 | 404 | 500;

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

type APIErrorResponse = {
  message: string;
  details?: APIErrorDetail[];
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
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
  } else if (env.APP_MODE !== "prod") {
    // only show unexpected error messages in lower environments
    errResponse.message = err.message;
  }

  return res.status(statusCode).json(errResponse);
};
