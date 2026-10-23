import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import {
  Button,
  buttonStyles,
  Card,
  Heading,
  Notice,
  Wordmark,
} from "@empire-cleaning/ui";
import { signOut } from "../session.ts";

// for an Account connected to nothing yet (ADR-0006): someone who signed up
// before asking for a Quote, or with a different email from their Quote Request
export function Welcome() {
  const { account } = useRouteContext({ from: "/welcome" });
  const navigate = useNavigate();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Wordmark centered />

      <Card>
        <Heading level={1} size={2}>
          Welcome
        </Heading>
        <p className="text-fg-muted">
          You're signed in as {account.email}. Ask us for a Quote and it will
          appear here.
        </p>
        {/* the Quote Request form replaces this with #3 */}
        <a
          href="tel:+16463209076"
          className={buttonStyles({ variant: "primary", className: "w-full" })}
        >
          <Phone aria-hidden size={20} />
          Call (646) 320-9076 for a Quote
        </a>
        <Notice>
          Asked us for a Quote with a different email? Sign out and sign in with
          that one.
        </Notice>
        <Button
          variant="secondary"
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
