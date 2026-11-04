import type { CorsOptions, CorsOptionsDelegate } from "cors";
import env from "../env.ts";
import cors from "cors";

// the web app, with its sign-in cookie, and the landing site, whose Guest
// "Request a Quote" form calls here without one. The landing site is never
// let in with the cookie: it's same-site, so the browser would send it, and
// a script there could read the visitor's data (#243)
const byOrigin: Record<string, CorsOptions> = {
  [env.CORS_ORIGIN_URL]: { origin: true, credentials: true },
  [env.LANDING_ORIGIN_URL]: { origin: true, credentials: false },
};

const corsOptions: CorsOptionsDelegate = (req, done) => {
  const origin = req.headers.origin;
  done(null, (origin && byOrigin[origin]) || { origin: false });
};

export const corsMiddleware = cors(corsOptions);
