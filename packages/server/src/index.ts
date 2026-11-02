// first, so errors from here on are reported; package.json's start also
// loads it with --import, before anything else, for tracing
import "./instrument.ts";
import { log, monitoring } from "#services/monitoring";
import { flushSentry } from "./services/monitoring/sentry.ts";
import { tick, TICK_MS } from "./scheduler.ts";
import { app } from "./server.ts";
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

app.listen(env.PORT, () => {
  log.info(`Server running on port ${env.PORT}`);
});

void tick();
setInterval(() => void tick(), TICK_MS);
