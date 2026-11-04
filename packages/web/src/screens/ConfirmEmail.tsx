import { useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { Mail, MailCheck, MailX } from "lucide-react";
import { Button, ButtonLink, Notice } from "@empire-cleaning/ui";
import { ApiError, postJson } from "../api.ts";
import { linkTo } from "../links.ts";
import { reportUnexpected } from "../monitoring.ts";
import { MessagePage } from "./MessagePage.tsx";

type EmailConfirmation =
  { confirmed: true; email: string } | { confirmed: false; problem: string };

// pressing the button on the link's page makes a Client's new email theirs,
// signed in or not (#243); a used, stale or taken one says why
const confirmEmail = async (token: string): Promise<EmailConfirmation> => {
  try {
    const { email } = await postJson<{ email: string }>(
      "/api/clients/email-changes/confirm",
      { token },
    );
    return { confirmed: true, email };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
      return { confirmed: false, problem: e.message };
    }
    throw e;
  }
};

// opening the link changes nothing: mail scanners open links before the
// person does, so only the button confirms it (#243)
export function ConfirmEmail() {
  const { token } = useSearch({ from: "/confirm-email" });
  const [result, setResult] = useState<EmailConfirmation>();
  const [isPending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = async () => {
    setPending(true);
    setFailed(false);
    try {
      setResult(await confirmEmail(token));
    } catch (e) {
      reportUnexpected(e);
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  if (!result) {
    return (
      <MessagePage title="Confirm your new email" icon={Mail}>
        <p className="text-fg-muted">
          Confirm it's yours, and we'll send your Quotes and notices there.
        </p>
        {failed && (
          <Notice tone="danger">
            Confirming didn't work. Please try again.
          </Notice>
        )}
        <Button
          isPending={isPending}
          onPress={() => void confirm()}
          className="w-full"
        >
          Confirm my email
        </Button>
      </MessagePage>
    );
  }
  if (result.confirmed) {
    return (
      <MessagePage title="Email confirmed" icon={MailCheck} tone="success">
        <p className="text-fg-muted [overflow-wrap:anywhere]">
          We'll send your Quotes and notices to {result.email}.
        </p>
      </MessagePage>
    );
  }
  return (
    <MessagePage title="Email not changed" icon={MailX} tone="danger">
      <p className="text-fg-muted">{result.problem}</p>
      <ButtonLink href={linkTo({ to: "/portal/details" })}>
        Change it again
      </ButtonLink>
    </MessagePage>
  );
}
