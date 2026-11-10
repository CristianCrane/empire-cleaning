import type { Page } from "@playwright/test";
import {
  acceptedJob,
  addCleaner,
  createStaff,
  emailsTo,
  expect,
  expectAccessible,
  offerJob,
  quoteSent,
  requestReschedule,
  setClock,
  setLanguage,
  signedInAs,
  signInLinkFor,
  signUp,
  test,
} from "./harness.ts";

// Sign-in, the Client portal (#303) and the Cleaner area (#305) in Spanish
// (ADR-0025): before sign-in in the language of the page the person came
// from, then in the Client's or Staff member's Preferred Language, the
// API's messages and Stripe's form with it. The core flows run once each
// in Spanish; the layout test opens every screen in it (layout.spec.ts).

const olive = {
  email: "olive@example.com",
  name: "Olive Owner",
  roles: ["office_staff" as const],
};
const casey = { name: "Casey Client", email: "casey@example.com" };

// the API's clock is at 4am on Monday 5 January 2026 in New York
const MONDAY_9AM = "2026-01-12T14:00:00Z";

// Casey's Job, with Cory Confirmed on it, Casey reading in Spanish
const bookedJob = async (page: Page) => {
  await createStaff(olive);
  await signUp(olive.email);
  const cory = await addCleaner("Cory Cleaner");
  const job = await acceptedJob({
    startsAt: MONDAY_9AM,
    officeEmail: olive.email,
  });
  await offerJob(job.id, cory.id, { confirmed: true });
  await signedInAs(page, casey.email);
  await setLanguage(page, "es");
  return job;
};

const choose = async (page: Page, field: string, option: RegExp) => {
  await page.getByRole("button", { name: new RegExp(`${field}$`) }).click();
  await page.getByRole("option", { name: option }).click();
};

test("someone from a Spanish page signs in in Spanish, its emailed link's page too", async ({
  page,
}) => {
  await page.goto("/?lang=es");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("heading", { name: "Iniciar sesión" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
  await expectAccessible(page);

  await page
    .getByRole("textbox", { name: "Correo electrónico" })
    .fill(casey.email);
  await page
    .getByRole("button", { name: "Enviarme un enlace para iniciar sesión" })
    .click();
  await expect(page.getByText("Revise su correo")).toBeVisible();
  // remembered in this browser, so the link's page is in Spanish too
  await page.goto(await signInLinkFor(casey.email));
  await expect(
    page.getByRole("heading", { name: "Inicie sesión en Empire Cleaning" }),
  ).toBeVisible();
});

test(
  "a Client reading in Spanish accepts a Quote and pays the Deposit",
  { tag: "@desktop" },
  async ({ page, browser }) => {
    await quoteSent(page, olive, casey);
    const client = await (await browser.newContext()).newPage();
    await signedInAs(client, casey.email);
    await setLanguage(client, "es");

    await client.goto("/portal");
    await expect(client.locator("html")).toHaveAttribute("lang", "es");
    await expect(
      client.getByRole("heading", { name: "Hola, Casey" }),
    ).toBeVisible();
    await client
      .getByRole("link", { name: "Ver su cotización" })
      .first()
      .click();

    const accept = client.getByRole("region", { name: "Pagar y reservar" });
    await expect(
      accept.getByText("Al pagar, acepta que Empire Cleaning"),
    ).toBeVisible();
    await expectAccessible(client);
    await accept.getByRole("button", { name: /^Aceptar y pagar \$/ }).click();

    await expect(
      client.getByText(/^Está reservado: Deep Clean el lun, 12 de ene/),
    ).toBeVisible();
    await expect(accept).toBeHidden();

    await client.getByRole("link", { name: "Inicio" }).first().click();
    await expect(client.getByText("Su primera limpieza")).toBeVisible();
    await expectAccessible(client);
  },
);

test("a Client reading in Spanish moves a clean, then cancels it, the API answering in Spanish", async ({
  page,
}) => {
  const job = await bookedJob(page);
  await page.goto(`/portal/jobs/${job.id}`);

  const card = page.getByRole("region", { name: "¿Necesita otra hora?" });
  await expect(card).toContainText(
    /Puede reprogramarla sin cargo hasta el dom, 11 de ene/,
  );
  await card.getByRole("button", { name: "Elegir otra hora" }).click();
  const dialog = page.getByRole("dialog", { name: "Elegir otra hora" });
  await expect(dialog).toContainText("Reprogramarla no tiene ningún cargo.");
  await dialog.getByText("O elija de una lista").click();
  await choose(page, "Día", /^mié, 14 de ene/);
  await choose(page, "Hora de inicio", /^10:00/);
  await expectAccessible(page);
  await dialog.getByRole("button", { name: "Enviar solicitud" }).click();

  await expect(page.getByText("Solicitud enviada")).toBeVisible();
  const pending = page.getByRole("region", {
    name: "Reprogramar su limpieza",
  });
  await expect(pending).toContainText(
    /Pidió reprogramarla para el mié, 14 de ene/,
  );
  await pending.getByRole("button", { name: "Retirar solicitud" }).click();
  await expect(page.getByText("Solicitud retirada")).toBeVisible();

  // the API's own message, in Spanish: a request withdrawn already
  const withdrawn = await page.request.post(
    `/api/jobs/mine/${job.id}/reschedule-request/withdraw`,
    { headers: { "accept-language": "es" } },
  );
  expect(withdrawn.status()).toBe(409);
  expect((await withdrawn.json()).message).toBe(
    "No hay ninguna solicitud para reprogramar esta limpieza.",
  );

  const cancel = page.getByRole("region", { name: "¿Necesita cancelar?" });
  await cancel.getByRole("button", { name: "Cancelar limpieza" }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "¿Cancelar su limpieza?",
  });
  await expect(confirm).toContainText("Cancelar no tiene ningún cargo.");
  await expectAccessible(page);
  await confirm.getByRole("button", { name: "Cancelar limpieza" }).click();

  await expect(page.getByText("Se canceló su limpieza")).toBeVisible();
  await expect(page.getByRole("region", { name: "Cancelada" })).toBeVisible();
  expect((await emailsTo(casey.email)).at(-1)!.subject).toBe(
    "Su limpieza está cancelada",
  );
});

test("a Client reading in Spanish sees what a second late move costs", async ({
  page,
}) => {
  const job = await bookedJob(page);
  // Sunday 3pm: the clean, on Monday at 9am, is less than 24 hours away
  await setClock("2026-01-11T20:00:00Z");
  // the first late move, free, which the Office confirms
  await requestReschedule(job.id, {
    date: "2026-01-12",
    time: "10:00",
    cost: "free_late",
  });
  await signedInAs(page, olive.email);
  await page.goto(`/office/jobs/${job.id}`);
  await page.getByRole("button", { name: "Answer" }).click();
  await page
    .getByRole("dialog", { name: "Move this job?" })
    .getByRole("button", { name: "Confirm move" })
    .click();
  await expect(page.getByText("Job moved")).toBeVisible();

  await signedInAs(page, casey.email);
  await page.goto(`/portal/jobs/${job.id}`);
  const card = page.getByRole("region", { name: "¿Necesita otra hora?" });
  // at the top of the page, clear of the bottom navigation
  await card.evaluate((region) => region.scrollIntoView());
  await expect(card).toContainText(
    /se conserva como cargo por cancelación tardía, y el precio completo se cobra cuando la limpieza esté terminada\./,
  );
});

test("a Client changes their language on Your details, and the portal follows", async ({
  page,
}) => {
  await createStaff(olive);
  await signUp(olive.email);
  await addCleaner("Cory Cleaner");
  await acceptedJob({ startsAt: MONDAY_9AM, officeEmail: olive.email });
  await signedInAs(page, casey.email);

  await page.goto("/portal/details");
  await expect(
    page.getByRole("main").getByText("English", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Contact details" })
    .getByRole("button", { name: "Edit" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Your contact details" });
  await dialog.getByRole("button", { name: /Language$/ }).click();
  await page.getByRole("option", { name: "Español" }).click();
  await dialog.getByRole("button", { name: "Save details" }).click();

  await expect(dialog).toBeHidden();
  // said in the language just chosen
  await expect(page.getByText("Datos guardados")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Sus datos" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("main").getByText("Español", { exact: true }),
  ).toBeVisible();
  await expectAccessible(page);

  // and back
  await page
    .getByRole("region", { name: "Datos de contacto" })
    .getByRole("button", { name: "Editar" })
    .click();
  const again = page.getByRole("dialog", { name: "Sus datos de contacto" });
  await again.getByRole("button", { name: /Idioma$/ }).click();
  await page.getByRole("option", { name: "English" }).click();
  await again.getByRole("button", { name: "Guardar datos" }).click();
  await expect(again).toBeHidden();
  await expect(
    page.getByRole("heading", { level: 1, name: "Your details" }),
  ).toBeVisible();
});

test("a Cleaner reading in Spanish takes an open job and marks it done, in tú", async ({
  page,
}) => {
  await createStaff(olive);
  await signUp(olive.email);
  await addCleaner("Cory Cleaner");
  // Friday, within 7 days, so it's open to Cory, free then
  const job = await acceptedJob({
    startsAt: "2026-01-09T14:00:00Z",
    officeEmail: olive.email,
  });
  await signedInAs(page, "cory@example.com");
  await setLanguage(page, "es");

  await page.goto("/cleaner");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByText("Todavía no tienes nada reservado"),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /^Ofertas/ })
    .first()
    .click();
  const open = page.getByRole("grid", { name: "Disponibles para ti" });
  await expect(open.getByRole("row")).toContainText("vie, 9 de ene, 9:00 a.m.");
  await open.getByRole("row").click();
  await expect(
    page.getByRole("region", { name: "¿Puedes tomarlo?" }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(page).toHaveURL(`/cleaner/jobs/${job.id}`);
  await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();

  // on the day, once it's started
  await setClock("2026-01-09T16:00:00Z");
  await page.reload();
  await page
    .getByRole("group", { name: "Qué hacer" })
    .getByRole("button", { name: "Marcar como terminado" })
    .click();
  const form = page.getByRole("dialog", {
    name: "Marcar este trabajo como terminado",
  });
  await expect(form).toContainText("Cuéntanos cómo te fue.");
  await expectAccessible(page);
  await form.getByText("Ligera", { exact: true }).click();
  await form.getByRole("button", { name: "Marcar como terminado" }).click();

  await expect(page.getByText("Trabajo marcado como terminado")).toBeVisible();
  const done = page.getByRole("region", { name: "Terminado" });
  await expect(done).toContainText("Ligera");
  await expect(done).toContainText("Nada distinto de la cotización");
  await expectAccessible(page);
});
