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
  setLanguage,
  signedInAs,
  signInLinkFor,
  signUp,
  test,
} from "./harness.ts";

// Sign-in and the Client portal in Spanish (ADR-0025, #303): before sign-in
// in the language of the page the person came from, then in the Client's
// Preferred Language, the API's messages and Stripe's form with it. The
// core flows run once each in Spanish; the layout test opens every screen
// in it (layout.spec.ts).

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
    "Your clean is cancelled",
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
