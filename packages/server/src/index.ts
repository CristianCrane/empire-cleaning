import { emailOpenPlaces } from "#features/assignments";
import { chaseBills, makeDueBills } from "#features/bills";
import { chaseProposedAdjustments } from "#features/completion";
import { sendDueReminders } from "#features/jobs";
import { generateServicePlanJobs } from "#features/service-plans";
import { app } from "./server.ts";
import env from "./env.ts";

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

// day-before reminders go out from 8am; looking every 10 minutes sends them
// soon after, and running twice (or on two servers) sends nothing twice
const REMINDER_CHECK_MS = 10 * 60 * 1000;
// and so do reminders and lapses of increases proposed to Clients, and
// Service Plans' Jobs coming within reach of the Schedule, each Monday's
// weekly Bills, reminders for Bills paid on their page and those late, and
// Open Places for Cleaners: each morning from 7am, and soon ones at once
const remind = () =>
  Promise.all([
    sendDueReminders().catch((error) =>
      console.error("reminders not sent:", error),
    ),
    chaseProposedAdjustments().catch((error) =>
      console.error("proposed Adjustments not chased:", error),
    ),
    generateServicePlanJobs().catch((error) =>
      console.error("Service Plan Jobs not generated:", error),
    ),
    makeDueBills().catch((error) =>
      console.error("weekly Bills not made:", error),
    ),
    chaseBills().catch((error) => console.error("Bills not chased:", error)),
    emailOpenPlaces().catch((error) =>
      console.error("Open Places not emailed:", error),
    ),
  ]);
void remind();
setInterval(remind, REMINDER_CHECK_MS);
