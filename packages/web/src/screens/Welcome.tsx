import type { ReactNode } from "react";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import {
  Button,
  Card,
  Heading,
  Notice,
  showToast,
  Logo,
} from "@empire-cleaning/ui";
import { forgetAccount, signOut } from "../session.ts";

// for an Account connected to nothing yet (ADR-0006): someone who signed up
// before asking for a Quote, or with a different email from their Quote
// Request. Asking for a Quote here makes them a Client. The form in its
// steps, what happens next beside it (UX pass, #96)
export function Welcome() {
  const { account } = useRouteContext({ from: "/welcome" });
  const navigate = useNavigate();

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 p-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo className="w-32" />
        <span className="flex items-center gap-2 text-sm text-fg-muted">
          Signed in as {account.email}
          <Button
            variant="text"
            size="sm"
            onPress={async () => {
              await signOut();
              void navigate({ to: "/sign-in" });
            }}
          >
            Sign out
          </Button>
        </span>
      </header>

      <div className="flex flex-col gap-2">
        <Heading level={1} size={2}>
          Welcome
        </Heading>
        <p className="text-fg-muted">
          Tell us about your home and we'll email you a Quote, usually within a
          working day.
        </p>
      </div>

      {/* in one column; what happens next beside the form from xl, in view
          as it scrolls, and after it below */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <QuoteRequestForm
            headingLevel={2}
            asker={{ kind: "account", email: account.email }}
            onSubmitted={async (receipt) => {
              // now a Client: the API connected this Account straight away
              forgetAccount();
              showToast({
                tone: "success",
                title: "Quote requested",
                description: `We'll email your Quote to ${receipt.emailedTo}.`,
              });
              await navigate({ to: "/portal" });
            }}
          />
        </Card>
        <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1 xl:self-start">
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
          <Notice>
            Asked us for a Quote with a different email? Sign out and sign in
            with that one.
          </Notice>
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
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
      >
        {n}
      </span>
      <div className="flex flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-fg-muted">{children}</span>
      </div>
    </li>
  );
}
