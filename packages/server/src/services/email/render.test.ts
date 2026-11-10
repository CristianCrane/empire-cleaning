import { describe, expect, test } from "vitest";
import { renderEmail } from "./render.tsx";
import {
  amounts,
  button,
  details,
  greeting,
  paragraph,
  withAppUrl,
  type Email,
} from "./blocks.ts";

const render = (email: Partial<Email>) =>
  renderEmail(
    { lang: "en", subject: "A subject", blocks: [], ...email },
    "https://landing.example/email-logo.png",
  );

describe("the email layout", () => {
  test("frames every email in the logo and the business's footer", async () => {
    const { subject, html, text } = await render({
      blocks: [paragraph("Hello")],
    });

    expect(subject).toBe("A subject");
    expect(html).toMatch(
      /<img alt="Empire Cleaning &amp; Pro Services Inc"[^>]* src="https:\/\/landing.example\/email-logo.png"/,
    );
    expect(html).toContain("(646) 320-9076");
    expect(text).toBe(
      "Hello\n\n-- \nEmpire Cleaning & Pro Services Inc · Queens, NYC and Long Island · (646) 320-9076 · empirecleaningandpro.com",
    );
  });

  test("frames a Spanish email in Spanish: its lang, greeting and footer (ADR-0025)", async () => {
    const { html, text } = await render({
      lang: "es",
      blocks: [greeting("Ana"), paragraph("Hola")],
    });

    expect(html).toMatch(/<html[^>]* lang="es"/);
    expect(html).toContain(">Hola, Ana:</p>");
    expect(html).toContain("Queens, NYC y Long Island");
    expect(text).toBe(
      "Hola, Ana:\n\nHola\n\n-- \nEmpire Cleaning & Pro Services Inc · Queens, NYC y Long Island · (646) 320-9076 · empirecleaningandpro.com",
    );
  });

  test("previews the first paragraph after the greeting by default", async () => {
    const { html } = await render({
      blocks: [
        greeting("Ana"),
        paragraph("Your clean is booked."),
        paragraph("Later"),
      ],
    });

    expect(html).toMatch(/data-skip-in-text="true">Your clean is booked\.</);
  });

  test("previews its own line when it has one", async () => {
    const { html } = await render({
      preview: "Paid, thank you",
      blocks: [paragraph("Your receipt")],
    });

    expect(html).toMatch(/data-skip-in-text="true">Paid, thank you</);
  });
});

test("a button's path becomes a link into the app, saying the email's language", () => {
  const email = withAppUrl(
    {
      lang: "es",
      subject: "Hola",
      blocks: [
        button("Ver", "/portal/jobs/1?token=t"),
        button("Google", "https://g.page/r"),
      ],
    },
    "https://app.example.com/",
  );

  expect(email.blocks).toEqual([
    {
      kind: "button",
      label: "Ver",
      href: "https://app.example.com/portal/jobs/1?token=t&lang=es",
    },
    { kind: "button", label: "Google", href: "https://g.page/r" },
  ]);
});

describe("the blocks", () => {
  test("a greeting", async () => {
    const { html, text } = await render({ blocks: [greeting("Ana")] });

    expect(html).toContain(">Hi Ana,</p>");
    expect(text).toMatch(/^Hi Ana,\n\n/);
  });

  test("a paragraph keeps its line breaks and is escaped", async () => {
    const { html, text } = await render({
      blocks: [paragraph("1 <b>Main</b> St & Co\nQueens")],
    });

    expect(html).toContain("1 &lt;b&gt;Main&lt;/b&gt; St &amp; Co");
    expect(html).not.toContain("<b>");
    expect(html).toContain("<br/>");
    expect(text).toMatch(/^1 <b>Main<\/b> St & Co\nQueens\n\n/);
  });

  test("details render as a table, and as Label: value lines in text", async () => {
    const { html, text } = await render({
      blocks: [
        details([
          { label: "When", value: "Monday, January 12 at 9:00 AM" },
          { label: "Where", value: "1 Main St <Apt 2>" },
        ]),
      ],
    });

    expect(html).toMatch(/<td[^>]*>When<\/td><td[^>]*>Monday, January 12/);
    expect(html).toContain("1 Main St &lt;Apt 2&gt;");
    expect(text).toMatch(
      /^When: Monday, January 12 at 9:00 AM\nWhere: 1 Main St <Apt 2>\n\n/,
    );
  });

  test("amounts render as a table with the total last and bold", async () => {
    const { html, text } = await render({
      blocks: [
        amounts(
          "en",
          [
            ["Clean", 12000],
            ["Tax", 1065],
          ],
          ["Total", 13065],
        ),
      ],
    });

    expect(html).toMatch(/font-weight:700[^>]*>Total<\/td>/);
    expect(html).toMatch(/font-weight:700[^>]*>\$130\.65<\/td>/);
    expect(html).toMatch(/font-weight:400[^>]*>\$120\.00<\/td>/);
    expect(text).toMatch(
      /^Clean: \$120\.00\nTax: \$10\.65\nTotal: \$130\.65\n\n/,
    );
  });

  test("a button links in HTML and prints its raw URL in text", async () => {
    const href = "https://app.example.com/pay?bill=1&ref=2";
    const { html, text } = await render({
      blocks: [button("Pay <now>", href)],
    });

    expect(html).toContain(
      `href="https://app.example.com/pay?bill=1&amp;ref=2"`,
    );
    expect(html).toContain("Pay &lt;now&gt;");
    expect(html).toContain('bgcolor="#06682F"');
    expect(text).toMatch(/^https:\/\/app\.example\.com\/pay\?bill=1&ref=2\n\n/);
  });
});
