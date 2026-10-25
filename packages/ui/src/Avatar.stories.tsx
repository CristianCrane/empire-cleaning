import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Avatar } from "./Avatar.tsx";

// a picture made here, so the stories never depend on the network
const photo = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#1f6f43"/><circle cx="20" cy="16" r="7" fill="#f4d9b8"/><rect x="9" y="26" width="22" height="14" rx="7" fill="#f4d9b8"/></svg>',
)}`;

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  args: { src: photo },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPicture: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("img")).not.toBeNull();
  },
};

export const WithoutPicture: Story = {
  args: { src: null },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("img")).toBeNull();
    await expect(canvasElement.querySelector("svg")).not.toBeNull();
  },
};

// a picture that won't load shows the icon instead of a broken image
export const PictureFailsToLoad: Story = {
  args: { src: "data:image/png;base64,not-an-image" },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector("img")).toBeNull());
    await expect(canvasElement.querySelector("svg")).not.toBeNull();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar src={photo} />
      <Avatar src={photo} size="lg" />
      <Avatar />
      <Avatar size="lg" />
    </div>
  ),
};
