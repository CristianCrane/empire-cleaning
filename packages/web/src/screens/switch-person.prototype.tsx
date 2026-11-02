// PROTOTYPE: throwaway. How a tester on the test site becomes another demo
// person (Jennifer in the Office → Helen, a Client) when a guided-tour link
// asks for it, at /prototype/switch-person?case=&layout= (no sign-in).
// ↑/↓ switch layouts, ←/→ the step of the journey. Nothing is sent: every
// button just moves to the next case. Lives only on prototype-switch-person.

import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  CalendarDays,
  ChevronDown,
  FlaskConical,
  MailCheck,
  Repeat,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Actions,
  Avatar,
  Button,
  buttonStyles,
  Card,
  Dialog,
  Form,
  Heading,
  IconTile,
  List,
  ListItem,
  Logo,
  Notice,
  TextField,
} from "@empire-cleaning/ui";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";

const inbox = "empirecleaningproservices@gmail.com";
const alias = (tag: string) => inbox.replace("@", `+${tag}@`);

type Person = {
  tag: string;
  name: string;
  role: "Office" | "Cleaner" | "Customer";
  shows: string;
};

// the seed's demo people, as the tour uses them
const people: Person[] = [
  { tag: "", name: "Jennifer", role: "Office", shows: "Runs the business" },
  {
    tag: "maria",
    name: "Maria Gonzalez",
    role: "Cleaner",
    shows: "Helen's and Grace's cleaner, an offer waiting",
  },
  {
    tag: "luz",
    name: "Luz Herrera",
    role: "Cleaner",
    shows: "Bell Blvd's cleaner",
  },
  {
    tag: "helen",
    name: "Helen Kowalski",
    role: "Customer",
    shows: "On a weekly plan",
  },
  {
    tag: "grace",
    name: "Grace Lee",
    role: "Customer",
    shows: "An extra charge to approve",
  },
  {
    tag: "rosa",
    name: "Rosa Diaz",
    role: "Customer",
    shows: "Asked to move a clean",
  },
  {
    tag: "bell",
    name: "Rachel Bell",
    role: "Customer",
    shows: "Bell Blvd Pediatrics, billed weekly",
  },
];
const emailOf = (p: Person) => (p.tag ? alias(p.tag) : inbox);
const jennifer = people[0]!;
const helen = people.find((p) => p.tag === "helen")!;

const cases = [
  { key: "1", name: "Signed in as Jennifer, taps Helen's link" },
  { key: "2", name: "Signed out, taps Helen's link" },
  { key: "3", name: "Link sent" },
  { key: "4", name: "Signed in as Helen" },
];
const layouts = [
  { key: "A", name: "Sign-in, filled in" },
  { key: "B", name: "Pick a person" },
  { key: "C", name: "Switch from the banner" },
];

// the Gmail search that finds the sign-in email for this alias
const gmailFor = (p: Person) =>
  `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`to:${emailOf(p)}`)}`;

export function SwitchPersonPrototype() {
  const search = useSearch({ from: "/prototype/switch-person" });
  const navigate = useNavigate();
  const caseKey = search.case ?? "1";
  const layout = search.layout ?? "A";
  const go = (next: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/switch-person",
      search: { case: caseKey, layout, ...next },
      replace: true,
    });
  const step = (to: string) => go({ case: to });

  const signedInAs =
    caseKey === "1" ? jennifer : caseKey === "4" ? helen : null;

  return (
    <>
      {layout === "C" ? (
        <BannerWithSwitch you={signedInAs} onPick={() => step("3")} />
      ) : (
        <PlainBanner you={layout === "B" ? signedInAs : null} />
      )}
      <TourContext />
      {caseKey === "4" ? (
        <HelenHome />
      ) : caseKey === "3" ? (
        <LinkSent person={helen} />
      ) : layout === "A" ? (
        <FilledSignIn
          person={helen}
          from={signedInAs}
          onSend={() => step("3")}
        />
      ) : layout === "B" ? (
        <PickPerson wanted={helen} from={signedInAs} onPick={() => step("3")} />
      ) : (
        <ThisPageIsFor
          person={helen}
          from={signedInAs}
          onSwitch={() => step("3")}
        />
      )}
      <PrototypeSwitcher
        variants={cases}
        current={caseKey}
        onChange={(key) => go({ case: key })}
      />
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(key) => go({ layout: key })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-36 md:bottom-16"
      />
    </>
  );
}

// not part of the design: the line in the tour doc that was tapped
function TourContext() {
  return (
    <p className="mx-auto mt-3 max-w-md rounded-md border border-dashed border-border px-3 py-2 text-xs text-fg-muted">
      Tapped in the tour doc: <strong>“See Helen's plan as Helen”</strong>
    </p>
  );
}

function PlainBanner({ you }: { you: Person | null }) {
  return (
    <p className="flex items-center justify-center gap-2 bg-warning-subtle px-4 py-1.5 text-center text-sm font-semibold text-warning-strong">
      <FlaskConical aria-hidden size={16} className="shrink-0" />
      Test site: no real payments or cleans
      {you && <span className="font-normal">· You're {you.name}</span>}
    </p>
  );
}

// C: who you are, and a way to be someone else, on every page
function BannerWithSwitch({
  you,
  onPick,
}: {
  you: Person | null;
  onPick: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warning-subtle px-4 py-1.5 text-sm text-warning-strong">
      <span className="flex items-center gap-2 font-semibold">
        <FlaskConical aria-hidden size={16} className="shrink-0" />
        Test site
      </span>
      <button
        type="button"
        className="flex items-center gap-1 rounded-full bg-surface px-3 py-0.5 font-semibold text-fg shadow-sm"
        onClick={() => setOpen(true)}
      >
        {you ? `You're ${you.name} (${you.role})` : "Not signed in"}
        <ChevronDown aria-hidden size={14} />
      </button>
      <Dialog title="Be someone else" isOpen={open} onOpenChange={setOpen}>
        <p className="text-sm text-fg-muted">
          We'll email their sign-in link to the business inbox.
        </p>
        <PeopleList
          current={you}
          onPick={() => {
            setOpen(false);
            onPick();
          }}
        />
      </Dialog>
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-4 pb-48">
      <Logo className="mx-auto w-44" />
      {children}
    </main>
  );
}

// A: the sign-in page as today, its email already filled in
function FilledSignIn({
  person,
  from,
  onSend,
}: {
  person: Person;
  from: Person | null;
  onSend: () => void;
}) {
  return (
    <Page>
      <Card>
        <Heading level={1} size={2}>
          Sign in as {person.name}
        </Heading>
        {from && (
          <Notice tone="info">
            You're signed in as {from.name}. Sending the link signs you out.
          </Notice>
        )}
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
        >
          <TextField
            label="Email"
            name="email"
            type="email"
            defaultValue={emailOf(person)}
          />
          <Button type="submit" className="w-full">
            Email me a sign-in link
          </Button>
        </Form>
      </Card>
    </Page>
  );
}

// B: a test-site page of the demo people, the one the tour asked for first
function PickPerson({
  wanted,
  from,
  onPick,
}: {
  wanted: Person;
  from: Person | null;
  onPick: () => void;
}) {
  return (
    <Page>
      <div className="flex flex-col gap-4">
        <Heading level={1} size={2}>
          Who do you want to be?
        </Heading>
        <Card>
          <div className="flex items-center gap-3">
            <Avatar />
            <div className="flex-1">
              <p className="font-semibold">{wanted.name}</p>
              <p className="text-sm text-fg-muted">
                {wanted.role} · {wanted.shows}
              </p>
            </div>
          </div>
          <Button className="w-full" onPress={onPick}>
            Be {wanted.name.split(" ")[0]}
          </Button>
          {from && (
            <p className="text-sm text-fg-muted">
              This signs you out as {from.name}.
            </p>
          )}
        </Card>
        <Heading level={2} size={4}>
          Or someone else
        </Heading>
        <PeopleList current={from} onPick={onPick} except={wanted} />
      </div>
    </Page>
  );
}

function PeopleList({
  current,
  except,
  onPick,
}: {
  current: Person | null;
  except?: Person;
  onPick: () => void;
}) {
  const shown = people.filter((p) => p !== except);
  return (
    <List aria-label="Demo people" onAction={onPick}>
      {shown.map((p) => (
        <ListItem
          key={p.name}
          id={p.name}
          title={p === current ? `${p.name} (you)` : p.name}
          description={`${p.role} · ${p.shows}`}
          start={<Avatar />}
          isDisabled={p === current}
        />
      ))}
    </List>
  );
}

// C: the page the link went to, for someone else: one button to become them
function ThisPageIsFor({
  person,
  from,
  onSwitch,
}: {
  person: Person;
  from: Person | null;
  onSwitch: () => void;
}) {
  return (
    <Page>
      <Card>
        <div className="flex items-start gap-3">
          <IconTile icon={ArrowRightLeft} tone="info" />
          <div className="flex flex-col gap-1">
            <Heading level={1} size={3}>
              This page is {person.name.split(" ")[0]}'s
            </Heading>
            <p className="text-sm text-fg-muted">
              {person.role} · {person.shows}
            </p>
          </div>
        </div>
        <Button className="w-full" onPress={onSwitch}>
          Switch to {person.name.split(" ")[0]}
        </Button>
        {from && (
          <p className="text-sm text-fg-muted">
            You're {from.name} now. We'll email {person.name.split(" ")[0]}'s
            sign-in link to the business inbox.
          </p>
        )}
      </Card>
    </Page>
  );
}

// every layout: the link is in the business inbox; a button finds it
function LinkSent({ person }: { person: Person }) {
  return (
    <Page>
      <Card>
        <Heading level={1} size={2}>
          Check the business inbox
        </Heading>
        <div className="flex items-start gap-3">
          <IconTile icon={MailCheck} tone="success" />
          <p>
            {person.name}'s sign-in link is on its way to{" "}
            <strong className="break-all">{emailOf(person)}</strong>, which
            lands in the business inbox. It works once, for 15 minutes.
          </p>
        </div>
        <Actions>
          <a
            href={gmailFor(person)}
            target="_blank"
            rel="noreferrer"
            className={buttonStyles({ variant: "primary" })}
          >
            Open it in Gmail
          </a>
        </Actions>
      </Card>
    </Page>
  );
}

// where the link lands: a sketch of Helen's portal home
function HelenHome() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-48">
      <Heading level={1} size={2}>
        Hi Helen
      </Heading>
      <Card>
        <div className="flex items-start gap-3">
          <IconTile icon={CalendarDays} tone="info" />
          <div>
            <p className="font-semibold">Next clean: Thursday, 9am</p>
            <p className="text-sm text-fg-muted">Maria · 69-50 Exeter St</p>
          </div>
        </div>
      </Card>
      <Card>
        <div className="flex items-start gap-3">
          <IconTile icon={Repeat} tone="neutral" />
          <div>
            <p className="font-semibold">Weekly plan</p>
            <p className="text-sm text-fg-muted">
              Thursdays at 9am · Standard cleaning
            </p>
          </div>
        </div>
      </Card>
    </main>
  );
}
