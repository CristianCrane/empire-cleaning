// PROTOTYPE: screenshots of the Schedule view variants, for looking at
import {
  acceptedJob,
  bookJob,
  createStaff,
  offerPlace,
  setUsualWeek,
  signedInAs,
  signUp,
  test,
} from "./harness.ts";

const out =
  "/tmp/claude-1000/-home-cris-github-CristianCrane-empire-cleaning/df8a5305-e783-425b-89ce-ebd18a4cf07e/scratchpad";

test("schedule view variants", async ({ page }) => {
  await createStaff({
    email: "olive@example.com",
    name: "Olive Owner",
    roles: ["office_staff"],
  });
  await signUp("olive@example.com");
  const cory = (await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  })) as { id: string };
  const dee = (await createStaff({
    name: "Dee Cleaner",
    email: "dee@example.com",
    roles: ["cleaner"],
  })) as { id: string };
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  await setUsualWeek(dee.id, [8, 8, 8, 8, 6, 0, 0]);
  const a = await acceptedJob({
    startsAt: "2026-01-06T14:00:00Z",
    officeEmail: "olive@example.com",
    crewSize: 2,
  });
  await offerPlace(a.id, cory.id, { confirmed: true });
  await offerPlace(a.id, dee.id);
  await bookJob({
    startsAt: "2026-01-06T19:00:00Z",
    labourHours: 3,
    crewSize: 1,
  });
  await bookJob({
    startsAt: "2026-01-07T13:00:00Z",
    labourHours: 6,
    crewSize: 2,
  });
  await bookJob({
    startsAt: "2026-01-08T15:30:00Z",
    labourHours: 4,
    crewSize: 1,
  });
  await bookJob({
    startsAt: "2026-01-09T13:00:00Z",
    labourHours: 14,
    crewSize: 2,
  });
  await signedInAs(page, "olive@example.com");

  for (const [width, name] of [
    [1280, "desktop"],
    [390, "phone"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    for (const v of ["A", "B", "C"]) {
      await page.goto(
        `/office/schedule?from=2026-01-05&to=2026-01-11&variant=${v}`,
      );
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `${out}/schedule-${v}-${name}.png`,
        fullPage: true,
      });
    }
  }
});
