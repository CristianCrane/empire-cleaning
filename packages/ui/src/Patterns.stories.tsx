import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  CreditCard,
  KeyRound,
  Phone,
  CalendarX,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  House,
  ClipboardPenLine,
  FileClock,
  Mail,
  MessageSquareText,
  Pencil,
  Repeat,
  Send,
  Store,
  UserX,
} from "lucide-react";
import { ActionRow } from "./ActionRow.tsx";
import { Button } from "./Button.tsx";
import { Card } from "./Card.tsx";
import { Checkbox } from "./Checkbox.tsx";
import { DateTile } from "./DateTile.tsx";
import { ShortcutTile, ShortcutTiles } from "./ShortcutTile.tsx";
import { Chip, ChipGroup } from "./ChipGroup.tsx";
import { ChoiceTile, ChoiceTiles } from "./ChoiceTiles.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { Heading } from "./Heading.tsx";
import { IconTile } from "./IconTile.tsx";
import { ButtonLink } from "./Link.tsx";
import { List, ListItem } from "./List.tsx";
import { Notice } from "./Notice.tsx";
import { Radio, RadioGroup } from "./RadioGroup.tsx";
import { Section } from "./Section.tsx";
import { Segment, SegmentedControl } from "./SegmentedControl.tsx";
import { StatusBadge, type StatusTone } from "./StatusBadge.tsx";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "./Table.tsx";
import { Tab, TabList, TabPanel, Tabs } from "./Tabs.tsx";
import { TextField } from "./TextField.tsx";
import { Timeline, TimelineItem } from "./Timeline.tsx";

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
          Buttons led by an icon, on the title's line and no taller than it, so
          a Section's box starts level with its neighbour's (on a phone they
          wrap under the title rather than squeeze it); the main action next to
          the page title is primary, with an icon too.
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
          house, an apartment, business premises; the Services, with the picture
          "What we clean" uses for the same work) are <code>ChoiceTiles</code>,
          the chosen one's meaning under them; ask one question rather than two
          back to back. Keep <code>RadioGroup</code> for options that are long
          or vary, like a Client's homes.
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

function RecordsAsStories() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="A record that moves through steps is its story, Now on top">
        <p>
          A page for something with a lifecycle, like a Quote, is a{" "}
          <code>Timeline</code>, newest first. Above it, what there is to do, in
          Notices. On top of it, <strong>Now</strong> holds the record as it
          stands, in one Card (the Current Quote). Below, each thing that
          happened to it, dated, with its details folded away until they're
          wanted. Work in progress isn't part of the story: a Draft is written
          on a page of its own, one Card ruled off into parts, and the Quote
          page only says it's there.
        </p>
      </Rule>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Example verdict="Do">
          <div className="flex flex-col gap-4">
            <Notice
              action={
                <Button variant="text" size="sm">
                  <Mail aria-hidden size={16} />
                  Email Max a link
                </Button>
              }
            >
              <strong>Waiting for Max to accept.</strong> He needs a card saved
              first.
            </Notice>
            <Timeline aria-label="A Quote's story, newest first">
              <TimelineItem icon={FileClock} title="Now" current>
                <Card>
                  <p>Current Quote: Standard Clean, $194.89</p>
                </Card>
              </TimelineItem>
              <TimelineItem
                icon={Send}
                title="Revision 1 sent"
                when="Oct 3"
                description="$194.89 · for Tue, Oct 13, 9:00 AM"
              />
              <TimelineItem
                icon={CalendarCheck}
                title="Site Visit done"
                when="Oct 2"
              />
              <TimelineItem
                icon={MessageSquareText}
                title="Max asked for a Quote"
                when="Oct 1"
              />
            </Timeline>
          </div>
        </Example>
        <Example verdict="Don't">
          <div className="flex flex-col gap-4">
            <Card title="What was asked">
              <p>Oct 1 · Standard Clean · Moderate</p>
            </Card>
            <Card title="Offer">
              <p>Sent Oct 3 · Expires Oct 8</p>
            </Card>
            <Card title="Deposit">
              <p>$48.72</p>
            </Card>
            <Button variant="secondary" className="self-end">
              Draft a new Revision
            </Button>
          </div>
        </Example>
      </div>
    </div>
  );
}

function NoticesHoldOneAction() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="A Notice holds one action, as text, on its right">
        <p>
          A Notice is passing news, never the page's main action, so its action
          is a <code>text</code> Button (<code>danger-text</code> to remove
          something), on the right of its text. One action per Notice: two
          things to say or do are two Notices, and an action that doesn't fit
          one belongs where it acts (Draft a new Revision on the Current Quote,
          Delete the Draft in the Draft's header).
        </p>
        <p>
          A page has at most one primary Button: once there are two, neither is
          primary.
        </p>
      </Rule>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Example verdict="Do">
          <div className="flex flex-col gap-3">
            <Notice
              tone="warning"
              action={
                <Button variant="text" size="sm">
                  <Pencil aria-hidden size={16} />
                  Continue the Draft
                </Button>
              }
            >
              <strong>Revision 2 is a Draft, not sent yet.</strong>
            </Notice>
            <Notice
              action={
                <Button variant="text" size="sm">
                  <Mail aria-hidden size={16} />
                  Email Kim a link
                </Button>
              }
            >
              <strong>Waiting for Kim to accept Revision 1.</strong> She needs a
              card saved first.
            </Notice>
          </div>
        </Example>
        <Example verdict="Don't">
          <Notice>
            <p>
              <strong>Revision 2 is a Draft.</strong> Kim needs a card saved to
              accept Revision 1.
            </p>
            <div className="flex gap-2 pt-2">
              <Button>Continue the Draft</Button>
              <Button>Email Kim a link</Button>
              <Button variant="danger-text">Delete the Draft</Button>
            </div>
          </Notice>
        </Example>
      </div>
    </div>
  );
}

function RowsOpenOneDialog() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="A row opens one dialog, with two Buttons at most">
        <p>
          A row in a List or Table holds no Buttons: it has one action, opening
          the item. Put each thing it's made of in its own place (a column, or
          the title, description and end of a row), never run together in one
          sentence. The dialog it opens shows the item, then does what can be
          done to it.
        </p>
        <p>
          A dialog ends with at most two Buttons: one filled (
          <code>primary</code>, or <code>danger</code> for something
          destructive) and one <code>quiet</code>: Cancel, or an alternative
          such as Dismiss, when the ✕ in its corner does the cancelling. Never
          open a dialog on a dialog: a second look before something destructive
          (Remove, Turn down) is a step in the same dialog, as an alertdialog.
        </p>
        <p>
          Settings read before they're changed: a page of them (the Price List)
          shows each part's figures as facts, changed in a dialog from the
          part's Edit, and its items as rows. Something kept for what already
          used it is retired in its dialog (untick Offered), never with a Button
          on its row.
        </p>
      </Rule>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Example verdict="Do">
          <Table aria-label="Adjustments" onRowAction={() => {}}>
            <TableHeader>
              <Column isRowHeader>What</Column>
              <Column>Change</Column>
              <Column>Price</Column>
              <Column>Status</Column>
            </TableHeader>
            <TableBody>
              <Row id="oven">
                <Cell>Inside the oven</Cell>
                <Cell>Not done</Cell>
                <Cell>−$29.94</Cell>
                <Cell>
                  <StatusBadge tone="success">Applied</StatusBadge>
                </Cell>
              </Row>
              <Row id="time">
                <Cell>Extra time</Cell>
                <Cell>+1 h</Cell>
                <Cell>+$59.88</Cell>
                <Cell>
                  <StatusBadge tone="warning">To review</StatusBadge>
                </Cell>
              </Row>
            </TableBody>
          </Table>
        </Example>
        <Example verdict="Don't">
          <List aria-label="Adjustments">
            <ListItem
              id="time"
              title="1 extra hour: $59.88"
              description={'"Heavier than quoted, the kitchen…" · lapses Nov 2'}
              end={
                <>
                  <StatusBadge tone="warning">To review</StatusBadge>
                  <Button size="sm">Review</Button>
                  <Button variant="quiet" size="sm">
                    Remove
                  </Button>
                </>
              }
            />
          </List>
        </Example>
      </div>
    </div>
  );
}

function AllAtOnceInTwoColumns() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="When every part of a record matters at once, two columns">
        <p>
          A record read as a whole, every part as important as the others (a
          Job: what it is, who's on it, its money and what happened), shows in
          one view without scrolling: what to do in Notices on top, then two
          columns: the record, its people and its money on the left, its history
          on the right as a Timeline, with room to grow. What can be done to the
          whole record is an <code>ActionBar</code> of icons beside its title,
          each named in a tooltip. A home for the Office reads the same way: its
          details, Service Plan and Site Visit left, its History right. A
          details card's facts follow the card's width, not the screen's (a
          container query), so they fit the narrower column. One column on a
          phone. A record read as steps, where what's next matters most (a
          Quote), is its story instead.
        </p>
      </Rule>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex flex-col gap-4">
          <Section title="Job">
            <Card>
              <p>Deep Clean · 6 Labour Hours · crew of 2</p>
            </Card>
          </Section>
          <Section title="Crew" description="1 of 2 places Confirmed">
            <List aria-label="Crew">
              <ListItem
                id="ben"
                title="Ben Cleaner"
                end={<StatusBadge tone="success">Confirmed</StatusBadge>}
              />
            </List>
          </Section>
          <Section title="Money">
            <Card>
              <p>Total $194.89 · Paid $48.72</p>
            </Card>
          </Section>
        </div>
        <div className="flex flex-col gap-4">
          <Section title="History">
            <Timeline aria-label="History, newest first">
              <TimelineItem
                icon={CalendarCheck}
                title="Ben Cleaner Confirmed"
                when="Oct 21"
              />
              <TimelineItem
                icon={Send}
                title="Offered to Ben Cleaner"
                when="Oct 20"
              />
            </Timeline>
          </Section>
        </div>
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
    [
      "success",
      "finished well, or running as it should",
      ["Completed", "Done", "Active", "Confirmed"],
    ],
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
          kind's tones in one map beside its labels. A <code>Notice</code>'s
          tone means the same: warning when it's the Office's to act on (a Job
          needing a Cleaner, a request to answer). Green is for the Office's
          view of what's going right: done, or running as it should (an Active
          plan, a Confirmed place); blue is for what's simply so.
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
          and <code>quiet</code> only in a dialog, for its Cancel or the one
          alternative beside its main action. A form's Save is primary, faded
          until there's something to save. Rows that open something show the
          hand cursor.
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

function WhatsNextFirst() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="A home screen answers one question: what's next">
        <p>
          Someone landing on a home screen, without a link to something in
          particular, wants to know what happens next. Answer it in one card:
          the soonest thing booked, led by its <code>DateTile</code> and read
          left to right, or, with nothing booked, where they stand (an{" "}
          <code>IconTile</code> at <code>lg</code> in its place). Its one Button
          is the page's primary; anything else in the header drops to secondary.
        </p>
        <p>
          What's waiting on them goes above it, a warning Notice each; what
          they're waiting on us for, an info Notice after those. Under it,{" "}
          <code>ShortcutTiles</code>: what they can do from where they stand,
          each with a hint of what's there. Lists of past things live on their
          own pages, not here.
        </p>
      </Rule>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Example verdict="Do">
          <Card>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <DateTile date="2026-11-03T14:00:00Z" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="font-semibold text-fg-muted">Your next clean</p>
                <p className="text-2xl font-semibold text-fg">
                  Tue, Nov 3, 9:00 AM
                </p>
                <p className="text-fg-muted">Standard Clean at 12 Elm St</p>
              </div>
              <Button>See the clean</Button>
            </div>
          </Card>
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
              externalHref="#"
            />
          </ShortcutTiles>
        </Example>
        <Example verdict="Don't">
          {[
            "Your Bills",
            "Your Service Plan",
            "Your upcoming Jobs",
            "Your past Jobs",
            "Your Quotes",
            "Your homes",
          ].map((title) => (
            <Card key={title} title={title}>
              <p className="text-sm text-fg-muted">A list of them</p>
            </Card>
          ))}
        </Example>
      </div>
    </div>
  );
}

function OwedFirst() {
  const payment = (
    day: string,
    title: string,
    amount: string,
    line?: string,
  ) => (
    <ListItem
      id={title + day}
      start={
        <span className="w-12 shrink-0 text-sm text-fg-muted tabular-nums">
          {day}
        </span>
      }
      title={title}
      description={line}
      end={<span className="font-semibold text-fg tabular-nums">{amount}</span>}
    />
  );
  return (
    <div className="flex flex-col gap-6">
      <Rule title="A money page answers one question first: do I owe anything?">
        <p>
          Lead with one card in the shape of a home screen's: what's owed and
          why, with the one Button that pays it, or that nothing is. Its tone is
          its state: warning while something is waiting on them, danger once it
          failed or is late, success with nothing owed. Ways in that are always
          there, like changing a card, sit in the header as a secondary Button,
          never inside a card whose Buttons change with its state.
        </p>
        <p>
          Then the latest few payments, one line each: the day, what it was for
          (the thing, not the kind of money), the amount on the right, refunds
          as money back. A second line only says what the day doesn't. All of
          them are a link away, by month with totals.
        </p>
      </Rule>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Example verdict="Do">
          <Card>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <IconTile icon={CircleCheck} tone="success" size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="font-semibold text-fg-muted">
                  You're all paid up
                </p>
                <p className="text-2xl font-semibold text-fg">Nothing owed</p>
                <p className="text-fg-muted">Paying with Visa ending 4242</p>
              </div>
            </div>
          </Card>
          <List aria-label="Latest payments">
            {payment(
              "Oct 21",
              "Extra on Standard Clean",
              "$22.50",
              "Approved after your Oct 19 clean",
            )}
            {payment("Oct 19", "Standard Clean", "$184.50")}
            {payment(
              "Sep 28",
              "Refund on Standard Clean",
              "−$22.50",
              "From your Sep 21 clean",
            )}
          </List>
        </Example>
        <Example verdict="Don't">
          <List aria-label="Charges">
            {payment(
              "Oct 21",
              "Balance",
              "$22.50",
              "Charge ch_3Pq… · succeeded",
            )}
            {payment(
              "Oct 19",
              "Balance",
              "$184.50",
              "Charge ch_3Pk… · succeeded",
            )}
            {payment(
              "Sep 28",
              "Refund",
              "$22.50",
              "Refund re_3Ox… · succeeded",
            )}
          </List>
        </Example>
      </div>
    </div>
  );
}

// A record's page, like a clean or a plan: what needs an answer first, as
// alerts; then its details card; then what can be done to it, a card each
function DetailsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Rule title="A details page: alerts, then the details, then what you can do">
        <p>
          What needs an answer from them goes first, as a Notice each: warning
          for waiting on them, danger for something that failed. Its one action
          opens the answer (a dialog, or the page that fixes it).
        </p>
        <p>
          Then one details card, titled outside: when, large, with an IconTile;
          then its facts in even columns across, each an icon, a value and a
          muted line saying what it is. Three text styles, no more.
        </p>
        <p>
          Then each thing they can do to it is a card of its own, titled
          outside, its text and Button on one row (`ActionRow`): the Button
          right and centred on the text, wrapping under it on a phone.
        </p>
      </Rule>
      <Example verdict="Do">
        <Notice tone="warning" action={<Button variant="text">Review</Button>}>
          <p>
            <strong>Please approve extra work.</strong> 1 extra hour, $59.88.
            Please answer by Jan 19, 2026.
          </p>
        </Notice>
        <Section title="Clean details">
          <Card>
            <div className="flex items-start gap-4">
              <IconTile icon={CalendarClock} size="lg" />
              <div className="flex flex-col gap-1">
                <p className="text-sm text-fg-muted">One-off clean</p>
                <p className="text-xl font-semibold text-fg">
                  Mon, Jan 12, 9:00 AM
                </p>
              </div>
            </div>
          </Card>
        </Section>
        <Section title="Need another time?">
          <Card>
            <ActionRow
              actions={<Button variant="secondary">Choose a new time</Button>}
            >
              <p>
                You can move it for free until{" "}
                <strong>Sun, Jan 11, 9:00 AM</strong>.
              </p>
            </ActionRow>
          </Card>
        </Section>
      </Example>
    </div>
  );
}

export const DetailsPageStory: Story = {
  name: "A details page: alerts, details, actions",
  render: () => <DetailsPage />,
};

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

export const RecordsAsStoriesStory: Story = {
  name: "Records as stories",
  render: () => <RecordsAsStories />,
};

export const NoticesHoldOneActionStory: Story = {
  name: "Notices hold one action",
  render: () => <NoticesHoldOneAction />,
};

export const RowsOpenOneDialogStory: Story = {
  name: "Rows open one dialog, two Buttons",
  render: () => <RowsOpenOneDialog />,
};

export const WhatsNextFirstStory: Story = {
  name: "A home screen answers what's next",
  render: () => <WhatsNextFirst />,
};

export const OwedFirstStory: Story = {
  name: "A money page answers what's owed",
  render: () => <OwedFirst />,
};

export const AllAtOnceInTwoColumnsStory: Story = {
  name: "All at once in two columns",
  render: () => <AllAtOnceInTwoColumns />,
};
