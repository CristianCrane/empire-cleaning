import type { CorsOptions } from "cors";
import env from "../env.ts";
import cors from "cors";

// the web app (with its sign-in cookie) and the landing site, whose Guest
// Quote Request form posts here without one
const corsOptions: CorsOptions = {
  origin: [env.CORS_ORIGIN_URL, env.LANDING_ORIGIN_URL],
  credentials: true,
};

export const corsMiddleware = cors(corsOptions);
