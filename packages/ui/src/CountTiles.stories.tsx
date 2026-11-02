import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDollarSign, ClipboardPenLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { expect } from "storybook/test";
import { CountTile, CountTiles } from "./CountTiles.tsx";

const meta = {
  title: "Components/CountTiles",
  component: CountTiles,
  args: { label: "Kinds", selected: null, onSelect: () => {}, children: null },
} satisfies Meta<typeof CountTiles>;

export default meta;
type Story = StoryObj<typeof meta>;

const Today = () => {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <CountTiles
        label="Needs attention by kind"
        selected={selected}
        onSelect={setSelected}
      >
        <CountTile
          id="jobs"
          icon={Sparkles}
          label="Jobs"
          count={7}
          hint="3 need Staff"
        />
        <CountTile
          id="quotes"
          icon={ClipboardPenLine}
          label="Quotes"
          count={4}
          hint="4 asked for"
        />
        <CountTile id="money" icon={CircleDollarSign} label="Money" count={0} />
      </CountTiles>
      <p className="text-sm text-fg-muted">
        Showing: {selected ?? "everything"}
      </p>
    </div>
  );
};

// Today's: what Needs attention, by kind. A kind with none can't be pressed
export const OnToday: Story = {
  render: () => <Today />,
  play: async ({ canvas, userEvent }) => {
    const jobs = canvas.getByRole("radio", { name: /Jobs/ });
    await userEvent.click(jobs);
    await expect(jobs).toBeChecked();
    await expect(canvas.getByText("Showing: jobs")).toBeVisible();
    // pressed again, everything
    await userEvent.click(jobs);
    await expect(canvas.getByText("Showing: everything")).toBeVisible();
    await expect(canvas.getByRole("radio", { name: /Money/ })).toBeDisabled();
  },
};
