import type { CorsOptions } from "cors";
import env from "../env.ts";
import cors from "cors";

const corsOptions: CorsOptions = {
  origin: env.CORS_ORIGIN_URL,
  credentials: true,
};

export const corsMiddleware = cors(corsOptions);
