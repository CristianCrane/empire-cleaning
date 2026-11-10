import * as Sentry from "@sentry/react";
import { LayoutDashboard, Users } from "lucide-react";
import { beforeAll, expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  ActionFooter,
  AppLayout,
  Button,
  Dialog,
  type NavItem,
} from "@empire-cleaning/ui";
import { identify, startMonitoring } from "@empire-cleaning/browser-monitoring";
import { feedbackButton } from "@empire-cleaning/browser-monitoring/feedback";
import { linkTo } from "./links.ts";
import feedbackLook from "./feedback.css?inline";

declare module "vitest/browser" {
  interface BrowserCommands {
    darkDevice: () => Promise<void>;
  }
}

// the test site's feedback button (main.tsx, feedback.css), in a real
// Chromium at phone width

const nav: NavItem[] = [
  {
    href: linkTo({ to: "/office" }),
    label: "Today",
    icon: LayoutDashboard,
    isCurrent: true,
  },
  { href: linkTo({ to: "/office/clients" }), label: "Clients", icon: Users },
];

// each item that would be sent: its header, and what it carries
const sent: [{ type?: string }, unknown][] = [];

beforeAll(() => {
  // nothing listens there: what would be sent is read before it goes
  startMonitoring({
    dsn: "http://public@localhost:9/1",
    environment: "test",
    feedback: feedbackButton(feedbackLook),
  });
  Sentry.getClient()!.on("beforeEnvelope", ([, items]) => {
    sent.push(...(items as typeof sent));
  });
  identify("account-1");
});

const button = () => page.getByRole("button", { name: "Send feedback" });
// the form: Sentry's <dialog> has no name of its own, only this heading
const form = page.getByRole("heading", { name: "Send feedback" });

// how far the button's foot is above the top of `element`
const clearance = (element: Element) => {
  const foot = button().element().getBoundingClientRect().bottom;
  return element.getBoundingClientRect().top - foot;
};

test("the button sits above the phone's tab bar", async () => {
  await render(
    <AppLayout area="Office" nav={nav} foot={() => null}>
      <p>Today</p>
    </AppLayout>,
  );
  await expect.element(button()).toBeVisible();

  const bar = page.getByRole("navigation", { name: "Office" }).element();
  expect(clearance(bar)).toBeGreaterThanOrEqual(0);
});

test("on a page with an ActionFooter, it sits above that too, wrapped or not", async () => {
  const actions = (labels: string[]) => (
    <AppLayout area="Cleaner" nav={nav} foot={() => null}>
      <ActionFooter aria-label="What to do">
        {labels.map((label) => (
          <Button key={label}>{label}</Button>
        ))}
      </ActionFooter>
    </AppLayout>
  );
  const { rerender } = await render(actions(["Mark done"]));
  const footer = () =>
    page.getByRole("group", { name: "What to do" }).element();
  // once the footer has measured itself
  await expect.poll(() => clearance(footer())).toBeGreaterThanOrEqual(0);

  // more than fits on one row
  await rerender(
    actions(["Couldn't get in", "Drop out of this job", "Mark done", "Call"]),
  );
  await expect
    .poll(() => footer().getBoundingClientRect().height)
    .toBeGreaterThan(100);
  await expect.poll(() => clearance(footer())).toBeGreaterThanOrEqual(0);
});

test("an open Dialog covers it", async () => {
  await render(
    <Dialog title="Drop out of this job?" isOpen>
      <p>Someone else will be asked.</p>
    </Dialog>,
  );
  const sheet = page.getByRole("dialog").element();
  await expect.element(sheet).toBeVisible();

  // drawn under the Dialog's backdrop, not over its sheet: outside a Dialog
  // nothing can be pressed (react-aria makes it inert), so a button drawn
  // over it couldn't be pressed, nor what it hides
  const layer = (element: Element) => Number(getComputedStyle(element).zIndex);
  const actor = document
    .getElementById("sentry-feedback")!
    .shadowRoot!.querySelector(".widget__actor")!;
  const backdrop = sheet.closest(".fixed")!;
  expect(layer(actor)).toBeLessThan(layer(backdrop));
});

test("the form follows the app's theme, not the device's", async () => {
  // the app is light unless pinned dark, whatever the device says (theme.tsx)
  await commands.darkDevice();
  await button().click();
  await expect.element(form).toBeVisible();

  // the light theme's overlay (tokens.css), not the dark one's
  const panel = document
    .getElementById("sentry-feedback")!
    .shadowRoot!.querySelector(".dialog__content")!;
  expect(getComputedStyle(panel).backgroundColor).toBe("rgb(255, 255, 255)");
});

test("a report carries the page, the Account ID and what they noticed, scrubbed, with no name or email", async () => {
  await render(<p>Today</p>);
  // still open from the test before
  await expect.element(form).toBeVisible();

  // what they noticed, and nothing to say who they are
  expect(page.getByRole("textbox").all()).toHaveLength(1);
  await expect
    .element(page.getByRole("button", { name: "Add a screenshot" }))
    .toBeVisible();
  await page
    .getByRole("textbox", { name: /What did you notice/ })
    .fill("Helen's next clean shows the wrong day");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  await expect
    .poll(() => sent.find(([header]) => header.type === "feedback"))
    .toBeDefined();
  const [, item] = sent.find(([header]) => header.type === "feedback")!;
  // as it's sent: JSON, so a key left undefined isn't
  const report = JSON.parse(JSON.stringify(item));
  expect(report).toMatchObject({
    type: "feedback",
    environment: "test",
    contexts: {
      feedback: {
        message: "Helen's next clean shows the wrong day",
        // the page, its query values scrubbed like any event's
        url: location.href.replace(/=[^&]*/g, "=[redacted]"),
      },
    },
  });
  // known by the Account ID alone: the form asks no name or email
  expect(report.user).toEqual({ id: "account-1" });
  expect(report.contexts.feedback).toMatchObject({
    contact_email: "",
    name: "",
  });
});
