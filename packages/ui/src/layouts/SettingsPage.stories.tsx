import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { expect, within } from "storybook/test";
import { Actions } from "../Actions.tsx";
import { Button } from "../Button.tsx";
import { Dialog } from "../Dialog.tsx";
import { StatusBadge } from "../StatusBadge.tsx";
import { TextField } from "../TextField.tsx";
import {
  SettingsList,
  SettingsPage,
  type SettingsPart,
} from "./SettingsPage.tsx";

const meta = {
  title: "Layout/SettingsPage",
  component: SettingsPage,
  args: { title: "Prices", parts: [] },
} satisfies Meta<typeof SettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// a part's dialog: its explanation, its figures, what saving does
const part = (
  id: string,
  title: string,
  summary: string,
  explain: string,
  fields: [string, string][],
): SettingsPart => ({
  id,
  title,
  summary,
  dialog: (state) => (
    <Dialog title={title} {...state}>
      {({ close }) => (
        <div className="flex flex-col gap-4">
          <p className="text-fg-muted">{explain}</p>
          {fields.map(([label, value]) => (
            <TextField key={label} label={label} defaultValue={value} />
          ))}
          <p className="text-sm text-fg-muted">
            Quotes already sent keep their prices.
          </p>
          <Actions>
            <Button variant="quiet" onPress={close}>
              Cancel
            </Button>
            <Button onPress={close}>Save</Button>
          </Actions>
        </div>
      )}
    </Dialog>
  ),
});

const prices: SettingsPart[] = [
  part(
    "condition",
    "Condition",
    "Light 0.85× · Average 1× · Heavy 1.4×",
    "It multiplies a home's hours. Extras aren't multiplied.",
    [
      ["Light (×)", "0.85"],
      ["Average (×)", "1"],
      ["Heavy (×)", "1.4"],
    ],
  ),
  part(
    "defaults",
    "Quote defaults",
    "25% deposit · 10% off plans · valid 30 days · 2 cleaners",
    "What a new quote starts with. You can change them on the quote.",
    [["Deposit (%)", "25"]],
  ),
];

const extra = (id: string, title: string, description: string) => ({
  id,
  title,
  description,
  onOpen: () => {},
});

// a busy Price List: the parts in one card, then the rows, one retired
// and folded
export const Busy: Story = {
  render: () => (
    <SettingsPage
      title="Prices"
      subtitle="Version 7 · saved Nov 3 by Jen"
      parts={prices}
    >
      <SettingsList
        title="Extras"
        actions={
          <Button variant="text" size="sm">
            <Plus aria-hidden size={16} />
            Add an extra
          </Button>
        }
        rows={[
          extra("fridge", "Inside the fridge", "0.5 hours · Standard Clean"),
          extra("oven", "Inside the oven", "0.75 hours · Standard Clean"),
        ]}
        retired={[
          {
            ...extra("closet", "Organizing a closet", "1 hour · No service"),
            badges: [<StatusBadge key="r">Retired</StatusBadge>],
          },
        ]}
      />
    </SettingsPage>
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByText(/multiplies/)).toBeNull();
    await userEvent.click(canvas.getByText("Condition"));
    const dialog = await within(document.body).findByRole("dialog", {
      name: "Condition",
    });
    await expect(dialog).toHaveTextContent(/multiplies/);
    await expect(canvas.queryByText("Organizing a closet")).not.toBeVisible();
  },
};

// the first time: a warning with its one action, no rows yet
export const FirstTime: Story = {
  render: () => (
    <SettingsPage
      title="Prices"
      subtitle="Starting figures"
      alerts={[
        {
          key: "starting",
          tone: "warning",
          children:
            "These are starting figures, not yours. Check each before you send a quote.",
          action: (
            <Button variant="text" size="sm">
              Keep these figures
            </Button>
          ),
        },
      ]}
      parts={prices}
    >
      <SettingsList title="Extras" rows={[]} empty="No extras yet" />
    </SettingsPage>
  ),
};
