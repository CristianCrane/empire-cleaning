import { db } from "./index.ts";
import { quotes } from "../features/quotes/quotes.schema.ts";

async function seed() {
  console.log("starting database seed...");

  try {
    console.log("deleting existing data...");
    await db.delete(quotes);

    console.log("creating quotes...");
    await db.insert(quotes).values({
      clientFirstName: "Seed client 1",
    });
  } catch (e) {
    console.error("database seed failed", e);
    process.exit(1);
  }
}

const isRunningFromTerminal = import.meta.url === `file://${process.argv[1]}`;

if (isRunningFromTerminal) {
  await seed();
  console.log("database seeded successfully");
  process.exit(0);
}

export default seed;
