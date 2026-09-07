import { defineConfig } from "drizzle-kit";
import env from "../env.ts";

export default defineConfig({
  schema: "./src/features/**/*.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DB_URL,
  },
});
