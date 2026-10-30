import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarClock, CreditCard, KeyRound, Phone } from "lucide-react";
import { ShortcutTile, ShortcutTiles } from "./ShortcutTile.tsx";

const meta = {
  title: "Components/ShortcutTile",
  component: ShortcutTiles,
  args: { label: "Shortcuts", children: null },
} satisfies Meta<typeof ShortcutTiles>;

export default meta;
type Story = StoryObj<typeof meta>;

// under the Client's next clean: what they can do from there, each with a
// hint of what's there
export const UnderTheNextClean: Story = {
  render: () => (
    <ShortcutTiles label="Shortcuts">
      <ShortcutTile
        icon={CalendarClock}
        label="Move or skip"
        hint="Your Tue, Nov 3 clean"
        externalHref="#"
      />
      <ShortcutTile
        icon={KeyRound}
        label="How we get in"
        hint="Key under the mat"
        externalHref="#"
      />
      <ShortcutTile
        icon={CreditCard}
        label="Your card"
        hint="Visa ending 4242"
        externalHref="#"
      />
      <ShortcutTile
        icon={Phone}
        label="Call us"
        hint="(646) 320-9076"
        externalHref="tel:+16463209076"
      />
    </ShortcutTiles>
  ),
};

// fewer than four fill the row on a wider screen; on a phone, the odd one
// out spans it
export const ThreeFillTheRow: Story = {
  render: () => (
    <ShortcutTiles label="Shortcuts">
      <ShortcutTile
        icon={CalendarClock}
        label="Move or cancel"
        hint="Your Tue, Nov 3 clean"
        externalHref="#"
      />
      <ShortcutTile
        icon={KeyRound}
        label="How we get in"
        hint="Key under the mat"
        externalHref="#"
      />
      <ShortcutTile
        icon={Phone}
        label="Call us"
        hint="(646) 320-9076"
        externalHref="tel:+16463209076"
      />
    </ShortcutTiles>
  ),
};
