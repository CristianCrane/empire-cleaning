import type { CorsOptions } from "cors";
import env from "../env.ts";

export const corsOptions: CorsOptions = {
  origin: env.CORS_ORIGIN_URL,
  credentials: true,
};

export default corsOptions;
