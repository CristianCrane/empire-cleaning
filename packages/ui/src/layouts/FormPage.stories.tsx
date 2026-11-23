import type { Meta, StoryObj } from "@storybook/react-vite";
import { Archive, LayoutDashboard, Send } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../Button.tsx";
import { Checkbox } from "../Checkbox.tsx";
import { Form } from "../Form.tsx";
import { NumberField } from "../NumberField.tsx";
import { FieldRow } from "../Field.tsx";
import { Notice } from "../Notice.tsx";
import { TextField } from "../TextField.tsx";
import { AppLayout } from "./AppLayout.tsx";
import { FormPage, FormPart } from "./FormPage.tsx";

const meta = {
  title: "Layout/FormPage",
  component: FormPage,
  args: {
    trail: [{ label: "Services", href: "#" }, { label: "Deep Clean" }],
    title: "Deep Clean",
    subtitle: "Version 7, saved by Jennifer on Nov 10",
    children: null,
  },
} satisfies Meta<typeof FormPage>;

export default meta;
type Story = StoryObj<typeof meta>;

const parts = (
  <>
    <FormPart title="What it is" summary="Deep Clean · Homes">
      <TextField label="Name" defaultValue="Deep Clean" isRequired />
    </FormPart>
    <FormPart title="Price">
      <FieldRow>
        <NumberField
          label="Hourly rate"
          description="Before tax"
          defaultValue={55}
          formatOptions={{ style: "currency", currency: "USD" }}
        />
        <NumberField
          label="Minimum price"
          defaultValue={180}
          formatOptions={{ style: "currency", currency: "USD" }}
        />
      </FieldRow>
    </FormPart>
    <FormPart
      title="Booking"
      summary="On a plan · no site visit · recommends nothing else"
    >
      <Checkbox defaultSelected>Can be on a cleaning plan</Checkbox>
    </FormPart>
  </>
);

// one card: what the person came for open, the rest folded to a line of
// what's set; a single page action at the end of the title row; what the
// fields come to beside them from xl, after them below that; the button
// at the card's foot
export const OneCard: Story = {
  args: {
    actions: [{ label: "Retire", icon: Archive, onAction: () => {} }],
    aside: {
      title: "Example quote",
      children: <p className="font-display text-3xl font-bold">$568.87</p>,
    },
    buttons: <Button type="submit">Save service</Button>,
    children: parts,
  },
  render: (args) => (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormPage {...args} />
    </Form>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Retire" })).toBeVisible();
    const booking = canvas.getByRole("button", { name: /Booking/ });
    await expect(booking).toHaveAttribute("aria-expanded", "false");
    await expect(booking).toHaveTextContent("On a plan");
    await userEvent.click(booking);
    await expect(
      canvas.getByRole("checkbox", { name: "Can be on a cleaning plan" }),
    ).toBeVisible();
  },
};

// a field a folded part holds that's found wrong opens it, so it can be seen
export const OpensOnAProblem: Story = {
  args: {
    buttons: <Button type="submit">Save service</Button>,
    children: (
      <FormPart title="What it is" summary="Unnamed">
        <TextField label="Name" name="name" isRequired />
      </FormPart>
    ),
  },
  render: (args) => (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormPage {...args} />
    </Form>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("textbox", { name: "Name", hidden: true }),
    ).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Save service" }));
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: "Name" })).toBeVisible(),
    );
  },
};

// the API's field error in a folded part opens it too
export const OpensOnTheApisError: Story = {
  args: {
    children: (
      <FormPart title="What it is" summary="Deep Clean">
        <TextField label="Name" name="name" defaultValue="Deep Clean" />
      </FormPart>
    ),
  },
  render: (args) => (
    <Form validationErrors={{ name: "Another service has that name." }}>
      <FormPage {...args} />
    </Form>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("Another service has that name."),
    ).toBeVisible();
  },
};

// what the page needs explained, folded; a card's consent in view above
// its button
export const Explained: Story = {
  args: {
    trail: [{ label: "Payments", href: "#" }, { label: "Your card" }],
    title: "Your card",
    subtitle: undefined,
    alerts: [{ key: "none", children: "You haven't saved a card yet." }],
    about: {
      label: "How your card is used",
      children: (
        <p className="text-sm text-fg-muted">
          We take a deposit from this card when you book.
        </p>
      ),
    },
    end: (
      <p className="text-sm text-fg-muted">
        By saving your card, you agree that Empire Cleaning can charge it.
      </p>
    ),
    buttons: <Button>Save card</Button>,
    children: (
      <FormPart title="Add a card">
        <TextField label="Card number" />
      </FormPart>
    ),
  },
};

// outside an area: a page of its own, the logo above, who's signed in
// under it on a phone and beside it from sm, with a line under that
export const OnItsOwn: Story = {
  parameters: { layout: "fullscreen" },
  args: {
    trail: undefined,
    title: "Welcome",
    subtitle: "Ask us for a quote and we'll email it to you.",
    account: (
      <div className="flex flex-col text-sm text-fg-muted sm:items-end sm:text-end">
        <span className="flex items-center gap-2">
          Signed in as sam@example.com
          <Button variant="text" size="sm" flush="end">
            Sign out
          </Button>
        </span>
        <p>Asked with another email? Sign out and use that one.</p>
      </div>
    ),
    children: (
      // a stepped form keeps its own steps, Back and Next
      <FormPart title="Where's the clean?">
        <TextField label="Street" />
      </FormPart>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("main")).toBeVisible();
  },
};

// in an area: the area's frame, and no logo or main of its own
export const InAnArea: Story = {
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "phone" } },
  args: { children: parts },
  render: (args) => (
    <AppLayout
      area="Office"
      nav={[
        {
          href: "#",
          label: "Services",
          icon: LayoutDashboard,
          isCurrent: true,
        },
      ]}
      foot={() => null}
    >
      <FormPage {...args} />
    </AppLayout>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("main")).toHaveLength(1);
  },
};

// a form with a price or a Send, on a phone: the price first below xl,
// beside the card from it; the button pinned at the foot, the price and the
// save's state on its left, the rest on the title row; a part's own text
// Buttons on its title line. From md the button is the header's primary,
// the rest behind its arrow ("Priced On A Laptop")
export const PricedOnAPhone: Story = {
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "phone" } },
  args: {
    trail: [{ label: "Quotes", href: "#" }, { label: "Draft quote" }],
    title: "Draft quote for Grace Murphy",
    subtitle: undefined,
    actions: [
      {
        label: "Delete draft",
        icon: Archive,
        danger: true,
        onAction: () => {},
      },
    ],
    aside: {
      title: "Quote",
      leads: true,
      children: <p className="font-display text-3xl font-bold">$568.87</p>,
    },
    end: <Notice tone="warning">Grace has no email yet.</Notice>,
    next: { label: "Send", icon: Send, onAction: () => {} },
    price: { line: "Deep Clean $568.87", short: "$568.87" },
    note: "Saved",
    children: (
      <>
        <FormPart
          title="Service"
          actions={
            <Button variant="text" size="sm">
              Add a weekday
            </Button>
          }
        >
          <TextField label="Type" defaultValue="Deep Clean" />
        </FormPart>
        <FormPart title="Terms" summary="2 cleaners · 25% deposit">
          <NumberField label="Cleaners" defaultValue={2} />
        </FormPart>
      </>
    ),
  },
  render: (args) => (
    <AppLayout
      area="Office"
      nav={[
        { href: "#", label: "Quotes", icon: LayoutDashboard, isCurrent: true },
      ]}
      foot={() => null}
    >
      <FormPage {...args} />
    </AppLayout>
  ),
  play: async ({ canvas }) => {
    const prices = canvas.getByRole("region", { name: "Quote" });
    const service = canvas.getByRole("region", { name: "Service" });
    // the price comes first
    await expect(
      prices.compareDocumentPosition(service) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const footer = canvas.getByRole("group", { name: "What to do" });
    await expect(footer).toHaveTextContent("Deep Clean $568.87");
    await expect(within(footer).getByRole("status")).toHaveTextContent("Saved");
    await expect(
      within(footer).getByRole("button", { name: "Send" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Add a weekday" }),
    ).toBeVisible();
    // the page's only action loses what can't be got back: outlined in
    // red, not filled, nor red words alone
    const remove = canvas.getByRole("button", { name: "Delete draft" });
    await expect(remove).toHaveClass(
      "border-danger",
      "text-danger",
      "bg-surface",
    );
  },
};

// the same from md: no bar at the foot; the button the header's primary,
// Delete draft behind its arrow, "Saved" beside it, read out from there
export const PricedOnALaptop: Story = {
  ...PricedOnAPhone,
  globals: { viewport: { value: "laptop" } },
  play: async ({ canvas }) => {
    const header = canvas.getByRole("group", { name: "What to do" });
    await expect(
      within(header).getByRole("button", { name: "Send" }),
    ).toBeVisible();
    // the one "Saved" read out (AppLayout keeps a status of its own)
    await expect(
      canvas.getAllByRole("status").filter((s) => s.textContent === "Saved"),
    ).toHaveLength(1);
    await userEvent.click(
      within(header).getByRole("button", { name: "More actions" }),
    );
    const item = await within(document.body).findByRole("menuitem", {
      name: "Delete draft",
    });
    // it fades in: visible once its animation has begun
    await waitFor(() => expect(item).toBeVisible());
    await userEvent.keyboard("{Escape}");
  },
};
