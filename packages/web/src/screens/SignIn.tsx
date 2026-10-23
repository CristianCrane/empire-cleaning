import { useState } from "react";
import { useSearch } from "@tanstack/react-router";
import {
  Button,
  Card,
  Form,
  Heading,
  Notice,
  TextField,
  Wordmark,
} from "@empire-cleaning/ui";
import { authClient } from "../session.ts";
import { GoogleLogo } from "./GoogleLogo.tsx";

// what went wrong, in words; codes come back from the API on ?error=
const errorMessages: Record<string, string> = {
  INVALID_TOKEN:
    "That sign-in link has expired or has already been used. Enter your email below for a fresh one.",
  signup_disabled:
    "There's no Empire Cleaning account for that Google address. Use the email address we have for you, or give us a call.",
};
const fallbackError = "Signing in didn't work. Please try again.";

export function SignIn() {
  const { next, error } = useSearch({ from: "/sign-in" });
  const [sentTo, setSentTo] = useState<string>();
  const [isSending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  // where sign-in links and Google return to: the page they asked for, or
  // back here (with ?error=) when something goes wrong
  const origin = window.location.origin;
  const callbackURL = `${origin}${next ?? "/"}`;
  const errorCallbackURL = `${origin}/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const sendLink = async (email: string) => {
    setSending(true);
    setSendFailed(false);
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL,
      errorCallbackURL,
    });
    setSending(false);
    if (error) {
      setSendFailed(true);
    } else {
      setSentTo(email);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Wordmark centered />

      <Card>
        <Heading level={1} size={2}>
          Sign in
        </Heading>

        {error && !sentTo && (
          <Notice tone="danger">{errorMessages[error] ?? fallbackError}</Notice>
        )}

        {sentTo ? (
          <>
            <Notice tone="success">
              <p className="font-semibold">Check your email</p>
              <p>
                If {sentTo} has an Empire Cleaning account, a sign-in link is on
                its way. It works once, for 15 minutes.
              </p>
            </Notice>
            <Button
              variant="secondary"
              className="w-full"
              onPress={() => setSentTo(undefined)}
            >
              Use a different email
            </Button>
          </>
        ) : (
          <>
            <p className="text-fg-muted">
              We'll email you a link that signs you in. No password needed.
            </p>
            {sendFailed && <Notice tone="danger">{fallbackError}</Notice>}
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                const email = new FormData(e.currentTarget).get("email");
                void sendLink(String(email));
              }}
            >
              <TextField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                isRequired
              />
              {/* full width: the form is narrow at every screen size */}
              <Button type="submit" isPending={isSending} className="w-full">
                Email me a sign-in link
              </Button>
            </Form>

            <div className="flex items-center gap-3 text-sm text-fg-muted">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onPress={() =>
                authClient.signIn.social({
                  provider: "google",
                  callbackURL,
                  errorCallbackURL,
                })
              }
            >
              <GoogleLogo />
              Continue with Google
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
