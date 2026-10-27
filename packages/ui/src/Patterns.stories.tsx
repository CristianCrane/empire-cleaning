import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { CalendarDays, CircleDollarSign, Inbox, UserX } from "lucide-react";
import { Card } from "./Card.tsx";
import { Heading } from "./Heading.tsx";
import { IconTile } from "./IconTile.tsx";
import { ButtonLink } from "./Link.tsx";
import { List, ListItem } from "./List.tsx";
import { Section } from "./Section.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

// how the components go together on a screen: the decisions the UX pass
// made, each picked from a prototype. #96 has the variants, why each won,
// and the prototype-* branch that holds them

function Example({
  verdict,
  children,
}: {
  verdict: "Do" | "Don't";
  children: ReactNode;
}) {
  return (
    <figure className="flex flex-1 flex-col gap-2">
      <figcaption>
        <StatusBadge tone={verdict === "Do" ? "success" : "danger"}>
          {verdict}
        </StatusBadge>
      </figcaption>
      <div className="rounded-lg bg-bg p-4">{children}</div>
    </figure>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex max-w-prose flex-col gap-2">
      <Heading level={2} size={3}>
        {title}
      </Heading>
      {children}
    </div>
  );
}

const jobs = (
  <List aria-label="Today's Jobs" onAction={() => {}}>
    <ListItem
      id="1"
      title="9:00 AM · Maria Lopez"
      description="41-12 Austin St · Standard Clean"
      end={<StatusBadge tone="info">Assigned</StatusBadge>}
    />
    <ListItem
      id="2"
      title="1:00 PM · Dev Patel"
      description="88 Grand St · Deep Clean"
      end={<StatusBadge tone="warning">Unassigned</StatusBadge>}
    />
  </List>
);

function SectionsNotCards() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="One box per section">
        <p>
          A List or Table draws its own box. Put it in a <code>Section</code> (a
          heading on the page), not a <code>Card</code>, or it reads as a box in
          a box. Keep <code>Card</code> for content that isn't boxed already: a
          Property's details, a summary, a form. Sections are spaced further
          apart than a Card's contents, so they stay distinct without borders.
        </p>
      </Rule>
      <div className="flex flex-col gap-4 md:flex-row">
        <Example verdict="Do">
          <Section title="Today's Jobs">{jobs}</Section>
        </Example>
        <Example verdict="Don't">
          <Card title="Tomorrow's Jobs">{jobs}</Card>
        </Example>
      </div>
    </div>
  );
}

function ActionFirstRows() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="Lead a to-do with what to do">
        <p>
          When a row asks the Office to act (Needs attention), its title is the
          action, an <code>IconTile</code> says what kind of item it is, and who
          it's for leads the description. A list of rows that look alike, told
          apart only by a trailing badge, makes the reader work out what each
          one wants.
        </p>
        <p>
          Rows that only show things (a Client's Jobs, a Bill's lines) stay as
          they are: the thing's name as the title, its status as a{" "}
          <code>StatusBadge</code>.
        </p>
      </Rule>
      <div className="flex flex-col gap-4 md:flex-row">
        <Example verdict="Do">
          <List aria-label="Needs attention" onAction={() => {}}>
            <ListItem
              id="1"
              title="Send a Quote"
              description="Maria Lopez · 41-12 Austin St · asked Oct 26"
              start={<IconTile icon={Inbox} tone="info" />}
            />
            <ListItem
              id="2"
              title="Assign Staff"
              description="Dev Patel · 88 Grand St · Oct 28, 1:00 PM"
              start={<IconTile icon={UserX} tone="warning" />}
            />
            <ListItem
              id="3"
              title="Collect the Balance"
              description="Nina Gold · $184.00 owed · 22 Pine St"
              start={<IconTile icon={CircleDollarSign} tone="danger" />}
            />
          </List>
        </Example>
        <Example verdict="Don't">
          <List aria-label="Needs attention" onAction={() => {}}>
            <ListItem
              id="1"
              title="Maria Lopez"
              description="41-12 Austin St · asked Oct 26"
              end={<StatusBadge tone="info">Quote Request</StatusBadge>}
            />
            <ListItem
              id="2"
              title="Dev Patel"
              description="88 Grand St · Oct 28, 1:00 PM"
              end={<StatusBadge tone="warning">Unassigned</StatusBadge>}
            />
            <ListItem
              id="3"
              title="Nina Gold"
              description="$184.00 owed · 22 Pine St"
              end={<StatusBadge tone="danger">Unpaid</StatusBadge>}
            />
          </List>
        </Example>
      </div>
    </div>
  );
}

function SchedulesAreCalendars() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="Schedules are calendars">
        <p>
          Wherever Jobs are shown by time, draw them on the Schedule's calendar
          (<code>ScheduleCalendar</code> in the web app): a week on the
          Schedule, one day locked to today on the Today screen, and the same
          calendar wherever a time is picked. Jobs are timed blocks sized by
          their time on site, so it reads like the owner's own calendar, which
          it may one day sync with.
        </p>
        <p>
          Name what's shown in the heading ("Today's Schedule"), and let the
          calendar's day header carry the date and how full it is. The way to
          the full Schedule is a small secondary button with a calendar icon,
          not a bare text link.
        </p>
      </Rule>
      <Example verdict="Do">
        <Section
          title="Today's Schedule"
          actions={
            <ButtonLink href="#" variant="secondary" size="sm">
              <CalendarDays aria-hidden size={16} />
              Week
            </ButtonLink>
          }
        >
          <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-fg-muted">
            ScheduleCalendar, one day
          </p>
        </Section>
      </Example>
    </div>
  );
}

const meta = {
  title: "Patterns",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SectionsNotCardsAroundLists: Story = {
  render: () => <SectionsNotCards />,
};

export const ActionFirstToDoRows: Story = {
  render: () => <ActionFirstRows />,
};

export const SchedulesAsCalendars: Story = {
  render: () => <SchedulesAreCalendars />,
};
