import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import {
  Building2,
  CalendarX,
  CalendarDays,
  CircleDollarSign,
  House,
  ClipboardPenLine,
  Pencil,
  Repeat,
  Store,
  UserX,
} from "lucide-react";
import { Button } from "./Button.tsx";
import { Card } from "./Card.tsx";
import { Checkbox } from "./Checkbox.tsx";
import { Chip, ChipGroup } from "./ChipGroup.tsx";
import { ChoiceTile, ChoiceTiles } from "./ChoiceTiles.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { Heading } from "./Heading.tsx";
import { IconTile } from "./IconTile.tsx";
import { ButtonLink } from "./Link.tsx";
import { List, ListItem } from "./List.tsx";
import { Radio, RadioGroup } from "./RadioGroup.tsx";
import { Section } from "./Section.tsx";
import { Segment, SegmentedControl } from "./SegmentedControl.tsx";
import { StatusBadge, type StatusTone } from "./StatusBadge.tsx";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "./Table.tsx";
import { Tab, TabList, TabPanel, Tabs } from "./Tabs.tsx";
import { TextField } from "./TextField.tsx";

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

const contact = (
  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
    <dt className="font-semibold">Email</dt>
    <dd>dev.patel@example.com</dd>
    <dt className="font-semibold">Phone</dt>
    <dd>(555) 010-4477</dd>
  </dl>
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
        <p>
          A Card on a page with Sections goes inside one, untitled, so every
          title on the page sits outside its box, Edit button and all. A
          Section's actions, and a page's besides its main one, are{" "}
          <code>text</code>
          Buttons led by an icon; the main action next to the page title is
          primary, with an icon too.
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
      <div className="flex flex-col gap-4 md:flex-row">
        <Example verdict="Do">
          <Section
            title="Contact details"
            actions={
              <Button variant="text" size="sm">
                <Pencil aria-hidden size={16} />
                Edit
              </Button>
            }
          >
            <Card>{contact}</Card>
          </Section>
        </Example>
        <Example verdict="Don't">
          <Card
            title="Billing contact"
            actions={<Button variant="secondary">Edit</Button>}
          >
            {contact}
          </Card>
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
              start={<IconTile icon={ClipboardPenLine} tone="info" />}
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
              end={<StatusBadge tone="info">Requested</StatusBadge>}
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

function WorkListsAreTables() {
  const quotes = [
    { id: "1", client: "Priya Shah", status: "Requested", waiting: "3 days" },
    { id: "2", client: "Ortiz Dental", status: "Requested", waiting: "5 days" },
    { id: "3", client: "Sam Ng", status: "Sent", waiting: "8 days" },
  ];
  return (
    <div className="flex flex-col gap-6">
      <Rule title="A growing work list is a Table, with status Tabs and a search">
        <p>
          A list the Office works through, many items in a few statuses (open
          Quotes), is a <code>Table</code>: sortable columns, longest waiting
          first. A <code>Tab</code> per status, each with its count, narrows it,
          and a search box above finds a Client or address. Keep both in the
          URL, so coming Back keeps them.
        </p>
        <p>
          Keep such a list to the work in hand (closed items live on their
          Client's pages), so it can load whole and search in the browser,
          without pages.
        </p>
        <p>
          A list that keeps growing whatever happens (Clients) opens on the Tab
          for what's current and holds 50 at a time, with Show more; the server
          works out the Tabs, their counts and the page. A search looks through
          All unless a Tab is picked. On a phone, columns that only describe the
          row fold under its first cell.
        </p>
      </Rule>
      <Example verdict="Do">
        <div className="flex flex-col gap-4">
          <TextField
            label="Search Quotes"
            type="search"
            placeholder="Client, business or address"
          />
          <Tabs>
            <TabList aria-label="Status">
              <Tab id="all" count={3}>
                All
              </Tab>
              <Tab id="requested" count={2}>
                Requested
              </Tab>
              <Tab id="sent" count={1}>
                Sent
              </Tab>
            </TabList>
            <TabPanel id="all">
              <Table aria-label="Open Quotes">
                <TableHeader>
                  <Column isRowHeader>Client</Column>
                  <Column>Status</Column>
                  <Column>Waiting</Column>
                </TableHeader>
                <TableBody items={quotes}>
                  {(q) => (
                    <Row id={q.id}>
                      <Cell>{q.client}</Cell>
                      <Cell>
                        <StatusBadge
                          tone={q.status === "Sent" ? "info" : "warning"}
                        >
                          {q.status}
                        </StatusBadge>
                      </Cell>
                      <Cell>{q.waiting}</Cell>
                    </Row>
                  )}
                </TableBody>
              </Table>
            </TabPanel>
          </Tabs>
        </div>
      </Example>
    </div>
  );
}
function QuietForms() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="Forms ask quietly, a few questions at a time">
        <p>
          A form shouldn't be a wall of boxes. Text fields are a tinted box with
          a line along the bottom, not a full outline. A short choice of one is
          a <code>SegmentedControl</code> (with the picked option's meaning
          under it), and a choice of several short options is a{" "}
          <code>ChipGroup</code>. Things easiest told apart by a picture (a
          house, an apartment, business premises) are <code>ChoiceTiles</code>;
          ask one question rather than two back to back. Keep{" "}
          <code>RadioGroup</code> for options that are long or vary, like a
          Client's homes.
        </p>
        <p>
          Optional fields wait behind a "+ Add …" link until they're wanted. A
          long form asks in steps, a few related questions each, with Next
          checking that step's fields; ask who someone is last, once they've
          told you what they need.
        </p>
      </Rule>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Example verdict="Do">
          <div className="flex flex-col gap-4">
            <ChoiceTiles label="What needs cleaning?" defaultValue="apartment">
              <ChoiceTile value="house" icon={House}>
                House
              </ChoiceTile>
              <ChoiceTile value="apartment" icon={Building2}>
                Apartment
              </ChoiceTile>
              <ChoiceTile value="commercial" icon={Store}>
                Business premises
              </ChoiceTile>
            </ChoiceTiles>
            <TextField label="Street address" />
            <SegmentedControl
              label="How much cleaning does it need?"
              defaultValue="moderate"
              description="Lived in, with some build-up in the kitchen and bathrooms"
            >
              <Segment value="light">Light</Segment>
              <Segment value="moderate">Moderate</Segment>
              <Segment value="heavy">Heavy</Segment>
            </SegmentedControl>
            <ChipGroup label="Any extras?" defaultValue={["oven"]}>
              <Chip value="oven">Inside the oven</Chip>
              <Chip value="fridge">Inside the fridge</Chip>
              <Chip value="windows">Interior windows</Chip>
            </ChipGroup>
          </div>
        </Example>
        <Example verdict="Don't">
          <div className="flex flex-col gap-4">
            <RadioGroup label="What needs cleaning?" defaultValue="home">
              <Radio value="home">A home</Radio>
              <Radio value="commercial">Business premises</Radio>
            </RadioGroup>
            <RadioGroup label="Type of home" defaultValue="apartment">
              <Radio value="house">House</Radio>
              <Radio value="apartment">Apartment</Radio>
              <Radio value="townhouse">Townhouse</Radio>
            </RadioGroup>
            <fieldset className="flex flex-col">
              <legend className="text-sm font-semibold">Any extras?</legend>
              <Checkbox defaultSelected>Inside the oven</Checkbox>
              <Checkbox>Inside the fridge</Checkbox>
              <Checkbox>Interior windows</Checkbox>
            </fieldset>
          </div>
        </Example>
      </div>
    </div>
  );
}

const meta = {
  title: "Patterns",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function EmptyStatesOfferTheAction() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="An empty place offers what fills it">
        <p>
          Where a page has room for one thing (a Property's Service Plan, its
          Site Visit) and there isn't one, an <code>EmptyState</code> says
          what's missing and offers the action that adds it, as a primary
          Button. When the action would be refused, say why in an info{" "}
          <code>Notice</code> in its place, with a link to what's in the way,
          rather than a Button that fails.
        </p>
      </Rule>
      <div className="flex flex-col gap-4 md:flex-row">
        <Example verdict="Do">
          <EmptyState
            icon={Repeat}
            title="No Service Plan"
            description="Quote regular cleaning."
          >
            <Button>
              <Repeat aria-hidden size={18} />
              Quote a Service Plan
            </Button>
          </EmptyState>
        </Example>
        <Example verdict="Don't">
          <Card title="Service Plan">
            <p className="text-fg-muted">None.</p>
          </Card>
        </Example>
      </div>
    </div>
  );
}

function StatusColours() {
  const tones: [StatusTone, string, string[]][] = [
    ["info", "just so, nothing to do", ["Booked", "Sent", "Accepted"]],
    ["success", "finished well", ["Completed", "Done"]],
    ["warning", "someone needs to act", ["Requested", "Unassigned", "Expired"]],
    ["danger", "went wrong", ["No Access", "Unpaid"]],
    [
      "neutral",
      "not going ahead, or not live yet",
      ["Draft", "Cancelled", "Declined"],
    ],
  ];
  return (
    <div className="flex flex-col gap-6">
      <Rule title="A status means the same colour everywhere">
        <p>
          A <code>StatusBadge</code>'s tone says what the status means, not
          which screen it's on: the same word is always the same colour, so a
          table mixing Quotes, Jobs and Site Visits reads at a glance. Keep each
          kind's tones in one map beside its labels.
        </p>
      </Rule>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
        {tones.map(([tone, meaning, examples]) => (
          <div key={tone} className="contents">
            <dt className="font-semibold">{meaning}</dt>
            <dd className="flex flex-wrap gap-2">
              {examples.map((label) => (
                <StatusBadge key={label} tone={tone}>
                  {label}
                </StatusBadge>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ClickableCatchesTheEye() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="What can be pressed catches the eye">
        <p>
          Every Button is drawn in the brand colour, so nothing pressable looks
          like plain content. How much colour says how much it matters:{" "}
          <code>primary</code> (filled) for the one thing to do,{" "}
          <code>secondary</code> (outlined) beside it, <code>text</code> for a
          Section's or page's own actions like Edit (<code>danger-text</code>{" "}
          when one undoes something, like Cancel visit), <code>danger</code>{" "}
          (filled red) for a destructive action standing alone, like End plan,
          and <code>quiet</code> only to back out of a dialog. A form's Save is
          primary, faded until there's something to save. Rows that open
          something show the hand cursor.
        </p>
      </Rule>
      <div className="flex flex-wrap items-center gap-3">
        <Button>Save corrections</Button>
        <Button variant="secondary">Record findings</Button>
        <Button variant="text" size="sm">
          <Pencil aria-hidden size={16} />
          Edit
        </Button>
        <Button variant="danger-text" size="sm">
          <CalendarX aria-hidden size={16} />
          Cancel visit
        </Button>
        <Button variant="quiet">Cancel</Button>
      </div>
    </div>
  );
}

export const SectionsNotCardsAroundLists: Story = {
  render: () => <SectionsNotCards />,
};

export const ActionFirstToDoRows: Story = {
  render: () => <ActionFirstRows />,
};

export const SchedulesAsCalendars: Story = {
  render: () => <SchedulesAreCalendars />,
};

export const WorkListsAsTables: Story = {
  render: () => <WorkListsAreTables />,
};

export const QuietFormsInSteps: Story = {
  render: () => <QuietForms />,
};

export const EmptyStatesOfferTheActionStory: Story = {
  name: "Empty states offer the action",
  render: () => <EmptyStatesOfferTheAction />,
};

export const ClickableCatchesTheEyeStory: Story = {
  name: "Clickable catches the eye",
  render: () => <ClickableCatchesTheEye />,
};

export const StatusColoursStory: Story = {
  name: "Status colours",
  render: () => <StatusColours />,
};
