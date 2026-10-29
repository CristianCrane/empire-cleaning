import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CalendarCheck,
  FileClock,
  Hourglass,
  MessageSquareText,
  Send,
} from "lucide-react";
import { Button } from "./Button.tsx";
import { Card } from "./Card.tsx";
import { Timeline, TimelineItem } from "./Timeline.tsx";

const meta = {
  title: "Components/Timeline",
  component: Timeline,
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

// a Quote's story: what to do now on top, then what happened, newest first
export const QuoteStory: Story = {
  args: {
    "aria-label": "This Quote's story",
    children: (
      <>
        <TimelineItem icon={FileClock} title="Now" current>
          <Card>
            <p>
              <strong>Expired Thu, Oct 8, 11:00 AM</strong> without a reply. To
              offer it again, draft a new Revision.
            </p>
            <Button variant="secondary" className="self-end">
              Draft a new Revision
            </Button>
          </Card>
        </TimelineItem>
        <TimelineItem icon={Hourglass} title="Expired" when="Oct 8, 2026" />
        <TimelineItem
          icon={Send}
          title="Revision 1 sent"
          when="Oct 3, 2026"
          description="$270.01 · for Tue, Oct 13, 9:00 AM"
        />
        <TimelineItem
          icon={CalendarCheck}
          title="Site Visit"
          when="Oct 2, 2026"
          description="Seen by Cleo"
        />
        <TimelineItem
          icon={MessageSquareText}
          title="Chris Vo asked for a Quote"
          when="Oct 1, 2026"
          description="Standard Clean"
        />
      </>
    ),
  },
};
