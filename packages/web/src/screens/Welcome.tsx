import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import {
  Button,
  Card,
  Heading,
  Notice,
  Wordmark,
  showToast,
} from "@empire-cleaning/ui";
import { forgetAccount, signOut } from "../session.ts";

// for an Account connected to nothing yet (ADR-0006): someone who signed up
// before asking for a Quote, or with a different email from their Quote
// Request. Asking for a Quote here makes them a Client.
export function Welcome() {
  const { account } = useRouteContext({ from: "/welcome" });
  const navigate = useNavigate();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-4 py-10">
      <Wordmark centered />

      <Card>
        <Heading level={1} size={2}>
          Welcome
        </Heading>
        <p className="text-fg-muted">
          You're signed in as {account.email}. Tell us about your home and we'll
          email you a Quote, usually within a working day.
        </p>
        <Notice>
          Asked us for a Quote with a different email? Sign out and sign in with
          that one.
        </Notice>
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
        <Button
          variant="quiet"
          className="w-full"
          onPress={async () => {
            await signOut();
            void navigate({ to: "/sign-in" });
          }}
        >
          Sign out
        </Button>
      </Card>
    </main>
  );
}
