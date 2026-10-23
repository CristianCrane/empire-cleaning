import type { Meta, StoryObj } from "@storybook/react-vite";
import { Heading } from "./Heading.tsx";
import { ThemeToggle } from "./theme.tsx";

// the tokens in tokens.css, shown in the current theme
function Swatches() {
  const groups: [string, string[]][] = [
    ["Surfaces", ["bg", "surface", "surface-sunken", "overlay"]],
    ["Text and lines", ["fg", "fg-muted", "border", "border-strong", "focus"]],
    [
      "Brand and actions",
      ["primary", "primary-hover", "primary-fg", "danger", "danger-fg"],
    ],
    [
      "Status tones",
      [
        "success-subtle",
        "success-strong",
        "info-subtle",
        "info-strong",
        "warning-subtle",
        "warning-strong",
        "danger-subtle",
        "danger-strong",
        "neutral-subtle",
        "neutral-strong",
      ],
    ],
  ];

  return (
    <div className="flex flex-col gap-6">
      {groups.map(([name, tokens]) => (
        <section key={name} className="flex flex-col gap-2">
          <Heading level={3}>{name}</Heading>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tokens.map((token) => (
              <li key={token} className="flex items-center gap-2">
                <span
                  className="size-10 shrink-0 rounded-md border border-border"
                  style={{ background: `var(--ec-${token})` }}
                />
                <code className="text-sm">{token}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Type() {
  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Clean spaces</Heading>
      <Heading level={2}>Stronger impact</Heading>
      <Heading level={3}>Section heading</Heading>
      <Heading level={4}>Small heading</Heading>
      <p>
        Body text in Barlow at 16px. Headings use Barlow Condensed in capitals,
        like the Empire Cleaning brand.
      </p>
      <p className="text-sm text-fg-muted">Muted text for secondary details.</p>
    </div>
  );
}

const meta = {
  title: "Foundations",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colours: Story = { render: () => <Swatches /> };

export const Typography: Story = { render: () => <Type /> };

export const Theme: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <p>Follows the device unless pinned; remembered on this device.</p>
      <ThemeToggle />
    </div>
  ),
};
