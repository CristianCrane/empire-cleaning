import type { RequestHandler } from "express";

// The API answers with data and redirects, never a page to show: a browser
// opening one runs nothing, loads nothing and frames it nowhere. The web app
// and landing site send their own (render.yaml); the README says what each is
// for.
const headers = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

export const securityHeadersMiddleware: RequestHandler = (_req, res, next) => {
  res.set(headers);
  next();
};
