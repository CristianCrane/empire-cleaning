async function seed() {
  console.log("starting database seed...");

  // no domain tables yet; feature tickets add their seed data here
}

const isRunningFromTerminal = import.meta.url === `file://${process.argv[1]}`;

if (isRunningFromTerminal) {
  await seed();
  console.log("database seeded successfully");
  process.exit(0);
}

export default seed;
