import { useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import {
  Actions,
  Button,
  Card,
  Form,
  Heading,
  IconTile,
  Notice,
  TextField,
  Wordmark,
  showToast,
} from "@empire-cleaning/ui";
import { authClient } from "../session.ts";
import { GoogleButton } from "./GoogleButton.tsx";

// what went wrong, in words; codes come back from the API on ?error=
const errorMessages: Record<string, string> = {
  INVALID_TOKEN:
    "That sign-in link has expired or has already been used. Enter your email below for a fresh one.",
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

  const sendLink = async (email: string, again = false) => {
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
      if (again) {
        showToast({ tone: "success", title: "Another link is on its way" });
      }
    }
  };

  // Google first: one tap for anyone with a Google account. The emailed
  // link under it, for everyone else (UX pass, #96)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Wordmark centered />

      <Card>
        <Heading level={1} size={2}>
          {sentTo ? "Check your email" : "Sign in"}
        </Heading>

        {error && !sentTo && (
          <Notice tone="warning">
            {errorMessages[error] ?? fallbackError}
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
            {sendFailed && <Notice tone="danger">{fallbackError}</Notice>}
            <Actions>
              <Button variant="text" onPress={() => setSentTo(undefined)}>
                Use a different email
              </Button>
              <Button
                variant="secondary"
                isPending={isSending}
                onPress={() => void sendLink(sentTo, true)}
              >
                Send it again
              </Button>
            </Actions>
          </>
        ) : (
          <>
            <GoogleButton
              onPress={() =>
                void authClient.signIn.social({
                  provider: "google",
                  callbackURL,
                  errorCallbackURL,
                })
              }
            />

            <div className="flex items-center gap-3 text-sm text-fg-muted">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <p className="text-sm text-fg-muted">
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
          </>
        )}
      </Card>

      {!sentTo && (
        <p className="text-center text-sm text-fg-muted">
          New to Empire Cleaning? Sign in with your email, then tell us about
          your home for a Quote.
        </p>
      )}
    </main>
  );
}
