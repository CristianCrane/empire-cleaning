import { defineConfig } from "drizzle-kit";
import { z } from "zod";
import { dbUrl } from "./url.ts";

// drizzle-kit loads .env itself. Generating a migration only compares the
// schema with the last snapshot, so it needs nothing set; the commands that
// connect (migrate, push, studio) read DB_URL, and only DB_URL (#389)
export default defineConfig({
  schema: "./src/features/**/*.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // read only by a command that connects: generate never reads it
    get url() {
      const result = z.object({ DB_URL: dbUrl }).safeParse(process.env);
      if (result.error) {
        console.error(
          `DB_URL: ${result.error.issues[0]?.message}. Set it in packages/server/.env or the environment`,
        );
        process.exit(1);
      }
      return result.data.DB_URL;
    },
  },
});
