import { z } from "zod";

// DB_URL's rule, for the server's environment (env.ts) and drizzle-kit's
// config, which reads it alone: importing env.ts checks every variable
export const dbUrl = z.url().nonempty();
