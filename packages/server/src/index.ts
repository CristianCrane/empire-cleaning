// first, so errors from here on are reported; package.json's start also
// loads it with --import, before anything else, for tracing
import "./instrument.ts";
import { log, monitoring } from "#services/monitoring";
import { flushSentry } from "./services/monitoring/sentry.ts";
import { markDatabase } from "#features/site";
import { tick, TICK_MS } from "./scheduler.ts";
import { app, listen } from "./server.ts";
import env from "./env.ts";

// errors nothing caught: reported like any other. An uncaught exception
// leaves the process in an unknown state, so it exits once it's sent
process.on("unhandledRejection", (reason) => {
  monitoring.error(reason, { unhandled: "rejection" });
});
process.on("uncaughtException", (error) => {
  monitoring.error(error, { unhandled: "exception" });
  void flushSentry().finally(() => process.exit(1));
});

// starting: a step that fails leaves nothing to serve, so it's reported and
// the process exits. Thrown at the top level, it would exit unreported
try {
  // so the seed can tell this database apart (features/site)
  await markDatabase();
  await listen(app, env.PORT);
} catch (error) {
  monitoring.error(error, { starting: "failed" });
  await flushSentry().finally(() => process.exit(1));
}
log.info(`Server running on port ${env.PORT}`);

void tick();
setInterval(() => void tick(), TICK_MS);
