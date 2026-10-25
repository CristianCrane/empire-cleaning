import { sendDueReminders } from "#features/jobs";
import { app } from "./server.ts";
import env from "./env.ts";

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

// day-before reminders go out from 8am; looking every 10 minutes sends them
// soon after, and running twice (or on two servers) sends nothing twice
const REMINDER_CHECK_MS = 10 * 60 * 1000;
const remind = () =>
  sendDueReminders().catch((error) =>
    console.error("reminders not sent:", error),
  );
void remind();
setInterval(remind, REMINDER_CHECK_MS);
