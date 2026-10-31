// PROTOTYPE: throwaway. Sign in, Welcome and the error pages, on made-up
// data, at /prototype/entry?case=1..8&layout=A..C (no sign-in). For the UX
// pass (#96). Lives only on prototype-sign-in.
//
// Sign in. A: today's card, tidied (one primary, text actions, a line for
// someone new). B: the same card beside a panel saying what the portal is
// for, from a laptop up. C: Google first, the email link under it.
//
// Welcome. A: one column, the form in its steps, signed in as / Sign out at
// the top and the different-email note a Notice with its one action. B: the
// form on one page, "What happens next" beside it. C: the form in its steps,
// "What happens next" beside it.
//
// The error pages. A: today's, with the way home a Button. B: centred, with
// an icon. C: as B, the way out a text link under it.
import { useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  CircleAlert,
  CreditCard,
  FileText,
  House,
  MailCheck,
  SearchX,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import {
  Actions,
  AppLayout,
  Button,
  ButtonLink,
  Card,
  Form,
  Heading,
  IconTile,
  Link,
  type NavItem,
  Notice,
  TextField,
  Wordmark,
  showToast,
} from "@empire-cleaning/ui";
import { linkTo } from "../links.ts";
import { GoogleLogo } from "./GoogleLogo.tsx";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";

const here = linkTo({ to: "/prototype/entry" });

const cases = [
  { key: "1", name: "Sign in" },
  { key: "2", name: "Sign in: link sent" },
  { key: "3", name: "Sign in: link expired" },
  { key: "4", name: "Welcome" },
  { key: "5", name: "Not found" },
  { key: "6", name: "Not found, in the portal" },
  { key: "7", name: "Something went wrong" },
  { key: "8", name: "Something went wrong, in the portal" },
];

const layoutsFor = (key: string) =>
  Number(key) <= 3
    ? [
        { key: "A", name: "One card, tidied" },
        { key: "B", name: "Beside what it's for" },
        { key: "C", name: "Google first" },
      ]
    : key === "4"
      ? [
          { key: "A", name: "One column, in steps" },
          { key: "B", name: "One page, what's next beside" },
          { key: "C", name: "In steps, what's next beside" },
        ]
      : [
          { key: "A", name: "Today's, a Button home" },
          { key: "B", name: "Centred, an icon" },
          { key: "C", name: "Centred, a link home" },
        ];

const nav: NavItem[] = [
  { href: here, label: "Home", icon: House },
  { href: here, label: "Cleans", icon: Sparkles, isCurrent: true },
  { href: here, label: "Payments", icon: Wallet },
  { href: here, label: "Your details", icon: UserRound },
];

export function EntryPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/entry",
      search: { case: key, layout, ...search } as never,
    });
  const layouts = layoutsFor(key);

  const n = Number(key);
  const page =
    n <= 3 ? (
      <SignIn key={key + layout} state={n} layout={layout} />
    ) : n === 4 ? (
      <Welcome key={layout} layout={layout} />
    ) : (
      <ErrorPage
        notFound={n <= 6}
        inArea={n === 6 || n === 8}
        layout={layout}
      />
    );

  return (
    <>
      {page}
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-20"
      />
      <PrototypeSwitcher
        variants={cases}
        current={key}
        onChange={(k) => go({ case: k })}
      />
    </>
  );
}

// ---- Sign in ----

function SignIn({ state, layout }: { state: number; layout: string }) {
  const [sentTo, setSentTo] = useState(
    state === 2 ? "casey@example.com" : undefined,
  );
  const expired = state === 3 && !sentTo;

  const emailForm = (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        setSentTo(String(new FormData(e.currentTarget).get("email")));
      }}
    >
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        isRequired
      />
      <Button type="submit" className="w-full">
        Email me a sign-in link
      </Button>
    </Form>
  );
  const google = (
    <Button variant="secondary" className="w-full">
      <GoogleLogo />
      Continue with Google
    </Button>
  );
  const or = (
    <div className="flex items-center gap-3 text-sm text-fg-muted">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );

  const card = (
    <Card>
      <Heading level={1} size={2}>
        {sentTo ? "Check your email" : "Sign in"}
      </Heading>
      {expired && (
        <Notice tone="warning">
          That sign-in link has expired or has already been used. Enter your
          email for a fresh one.
        </Notice>
      )}
      {sentTo ? (
        <>
          <div className="flex items-start gap-3">
            <IconTile icon={MailCheck} tone="success" />
            <p>
              A sign-in link is on its way to <strong>{sentTo}</strong>. It
              works once, for 15 minutes.
            </p>
          </div>
          <p className="text-sm text-fg-muted">
            Not there? Check your spam folder, or send it again.
          </p>
          <Actions>
            <Button variant="text" onPress={() => setSentTo(undefined)}>
              Use a different email
            </Button>
            <Button variant="secondary" onPress={() => showToast({ tone: "success", title: "Sent again" })}>
              Send it again
            </Button>
          </Actions>
        </>
      ) : layout === "C" ? (
        <>
          {google}
          {or}
          <p className="text-sm text-fg-muted">
            Or we'll email you a link that signs you in. No password needed.
          </p>
          {emailForm}
        </>
      ) : (
        <>
          <p className="text-fg-muted">
            We'll email you a link that signs you in. No password needed.
          </p>
          {emailForm}
          {or}
          {google}
        </>
      )}
    </Card>
  );
  const newHere = !sentTo && (
    <p className="text-center text-sm text-fg-muted">
      New to Empire Cleaning? Sign in with your email, then tell us about your
      home for a Quote.
    </p>
  );

  if (layout === "B") {
    return (
      <main className="grid min-h-dvh lg:grid-cols-2">
        <div className="hidden flex-col justify-center gap-8 bg-primary/10 p-12 lg:flex">
          <Wordmark />
          <Heading level={2} size={2}>
            Your cleans, in one place
          </Heading>
          <ul className="flex flex-col gap-5">
            <Point icon={FileText} title="Your Quotes">
              See what a clean costs, choose one and book it.
            </Point>
            <Point icon={CalendarClock} title="Your cleans">
              When the team's coming, and moving a clean when plans change.
            </Point>
            <Point icon={CreditCard} title="Your payments">
              Every Bill and receipt, and the card you pay with.
            </Point>
          </ul>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-col justify-center gap-6 p-4">
          <div className="lg:hidden">
            <Wordmark centered />
          </div>
          {card}
          {newHere}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Wordmark centered />
      {card}
      {newHere}
    </main>
  );
}

function Point({
  icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <IconTile icon={icon} />
      <div className="flex flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-fg-muted">{children}</span>
      </div>
    </li>
  );
}

// ---- Welcome ----

const email = "casey@example.com";

function Welcome({ layout }: { layout: string }) {
  const signOut = (
    <Button variant="text" size="sm">
      Sign out
    </Button>
  );
  const differentEmail = (
    <Notice>
      Asked us for a Quote with a different email? Sign out (top right) and
      sign in with that one.
    </Notice>
  );
  const next = (
    <Card>
      <Heading level={2} size={4}>
        What happens next
      </Heading>
      <ol className="flex flex-col gap-4">
        <Step n={1} title="You tell us about your home">
          The rooms, how it's looking and when suits you.
        </Step>
        <Step n={2} title="We email you a Quote">
          Usually within a working day, with the clean we'd recommend.
        </Step>
        <Step n={3} title="You choose and book">
          Pay the Deposit here and your clean is booked.
        </Step>
      </ol>
    </Card>
  );
  const form = (onePage: boolean) => (
    <QuoteRequestForm
      headingLevel={2}
      asker={{ kind: "account", email }}
      page={
        onePage
          ? {
              aside: (
                <div className="flex flex-col gap-4">
                  {next}
                  {differentEmail}
                </div>
              ),
            }
          : undefined
      }
      onSubmitted={() => showToast({ tone: "success", title: "Quote requested" })}
    />
  );

  const top = (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Wordmark />
      <span className="flex items-center gap-2 text-sm text-fg-muted">
        {email}
        {signOut}
      </span>
    </header>
  );
  const intro = (
    <div className="flex flex-col gap-2">
      <Heading level={1} size={2}>
        Welcome
      </Heading>
      <p className="text-fg-muted">
        Tell us about your home and we'll email you a Quote, usually within a
        working day.
      </p>
    </div>
  );

  if (layout === "A") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-4 py-10">
        {top}
        {intro}
        {differentEmail}
        <Card>{form(false)}</Card>
      </main>
    );
  }

  if (layout === "B") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 p-4 py-10">
        {top}
        {intro}
        {form(true)}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 p-4 py-10">
      {top}
      {intro}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6">
          <Card>{form(false)}</Card>
        </div>
        <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1 xl:self-start">
          {next}
          {differentEmail}
        </aside>
      </div>
    </main>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
        {n}
      </span>
      <div className="flex flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-fg-muted">{children}</span>
      </div>
    </li>
  );
}

// ---- the error pages ----

function ErrorPage({
  notFound,
  inArea,
  layout,
}: {
  notFound: boolean;
  inArea: boolean;
  layout: string;
}) {
  const title = notFound ? "Page not found" : "Something went wrong";
  const line = notFound
    ? "That page doesn't exist, or it isn't yours to see."
    : "We couldn't load this page. Try again in a moment.";
  const home = linkTo({ to: "/prototype/entry" });
  const tryAgain = (
    <Button onPress={() => showToast({ title: "Trying again" })}>
      Try again
    </Button>
  );

  const card =
    layout === "A" ? (
      <Card>
        <Heading level={1} size={2}>
          {title}
        </Heading>
        <p className="text-fg-muted">{line}</p>
        <Actions>
          {notFound ? (
            <ButtonLink href={home}>Go to your home page</ButtonLink>
          ) : (
            <>
              <ButtonLink variant="text" href={home}>
                Go to your home page
              </ButtonLink>
              {tryAgain}
            </>
          )}
        </Actions>
      </Card>
    ) : (
      <Card>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <IconTile
            icon={notFound ? SearchX : CircleAlert}
            tone={notFound ? "neutral" : "warning"}
            size="lg"
          />
          <Heading level={1} size={2}>
            {title}
          </Heading>
          <p className="text-fg-muted">{line}</p>
          {layout === "B" ? (
            <div className="flex flex-wrap justify-center gap-3">
              {notFound ? (
                <ButtonLink href={home}>Go to your home page</ButtonLink>
              ) : (
                <>
                  <ButtonLink variant="secondary" href={home}>
                    Go to your home page
                  </ButtonLink>
                  {tryAgain}
                </>
              )}
            </div>
          ) : (
            <>
              {!notFound && tryAgain}
              <Link href={home}>Go to your home page</Link>
            </>
          )}
        </div>
      </Card>
    );

  if (inArea) {
    return (
      <AppLayout
        area="Client"
        nav={nav}
        account={<span className="text-sm text-fg-muted">Casey</span>}
      >
        <div className="mx-auto w-full max-w-md">{card}</div>
      </AppLayout>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Wordmark centered />
      {card}
    </main>
  );
}
