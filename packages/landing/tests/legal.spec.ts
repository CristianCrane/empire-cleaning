import {
  LANGUAGES,
  LEGAL_KEYS,
  formats,
  legalPages,
  messages,
} from "@empire-cleaning/models";
import { deposit, moveOrCancel } from "../src/faqs.ts";
import { deposito, reprogramarOCancelar } from "../src/faqs.es.ts";
import { legalOf } from "../src/legal/index.ts";
import { pages, pathOf } from "../src/routes.ts";
import { words } from "../src/words.ts";
import { expect, expectAccessible, test } from "./harness.ts";

// the Privacy policy and the Terms of service (#462), each in both
// languages; that each says its language and links its twin is
// spanish.spec.ts's
for (const key of LEGAL_KEYS) {
  for (const lang of LANGUAGES) {
    const path = pathOf({ kind: "legal", legal: key }, lang);
    const { name } = legalPages[lang][key];
    const policy = legalOf(key)[lang];

    test(`${path} gives its name, the day it took effect and its parts, with nothing to sell`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page).toHaveTitle(`${name} | Empire Cleaning`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
      await expect(
        page.getByText(
          words[lang].effective(formats[lang].formatFullDay(policy.effective)),
        ),
      ).toBeVisible();
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(
        policy.sections.map((s) => s.title),
      );
      await expect(
        page.getByRole("link", { name: messages[lang].REQUEST_A_QUOTE }),
      ).toHaveCount(0);
      // the hero plain, then each part the other of the one before
      const raised = await page
        .locator("main > section")
        .evaluateAll((all) =>
          all.map(
            (s) => getComputedStyle(s).backgroundColor !== "rgba(0, 0, 0, 0)",
          ),
        );
      expect(raised).toEqual(raised.map((_, i) => i % 2 === 1));
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }

  test(`the ${key} page has no accessibility violations, in either theme`, async ({
    page,
  }) => {
    for (const theme of ["light", "dark"]) {
      await page.goto(pathOf({ kind: "legal", legal: key }, "en"));
      await page.evaluate((t) => localStorage.setItem("ec-theme", t), theme);
      await page.reload();
      await test.step(`${theme} theme`, () => expectAccessible(page));
    }
  });
}

// the rules are the app's own words, read from where they live, so the
// Terms can't say a rule differently from the card form or the FAQ
test("the Terms of service quote the card form's consent and the FAQ's answers, in each language", async ({
  page,
}) => {
  const said = {
    en: [deposit.answer, moveOrCancel],
    es: [deposito.answer, reprogramarOCancelar],
  };
  for (const lang of LANGUAGES) {
    await page.goto(pathOf({ kind: "legal", legal: "terms" }, lang));
    for (const text of [...said[lang], messages[lang].cardConsent(true)]) {
      await expect(page.locator("main")).toContainText(text);
    }
  }
});

test("the foot links both policies in the page's language, English or Spanish", async ({
  page,
}) => {
  for (const path of [pathOf(pages[0]!, "en"), pathOf(pages[0]!, "es")]) {
    await page.goto(path);
    const lang = path.startsWith("/es/") ? "es" : "en";
    const foot = page
      .locator("footer")
      .getByRole("navigation", { name: words[lang].footer.legal });
    for (const key of LEGAL_KEYS) {
      await foot
        .getByRole("link", { name: legalPages[lang][key].name })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`${pathOf({ kind: "legal", legal: key }, lang)}$`),
      );
      await page.goBack();
    }
  }
});

test("a policy reads without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const policy = legalOf("privacy").en;
  await page.goto(pathOf({ kind: "legal", legal: "privacy" }, "en"));

  for (const { title } of policy.sections) {
    await expect(
      page.getByRole("heading", { level: 2, name: title }),
    ).toBeVisible();
  }
  await context.close();
});
