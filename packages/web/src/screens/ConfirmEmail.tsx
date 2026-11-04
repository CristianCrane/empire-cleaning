import { useLoaderData } from "@tanstack/react-router";
import { MailCheck, MailX } from "lucide-react";
import { ButtonLink } from "@empire-cleaning/ui";
import { ApiError, postJson } from "../api.ts";
import { linkTo } from "../links.ts";
import { MessagePage } from "./MessagePage.tsx";

export type EmailConfirmation =
  { confirmed: true; email: string } | { confirmed: false; problem: string };

// opening the link sent to a Client's new email makes it theirs, signed in
// or not (#243); a used, stale or taken one says why
export const confirmEmail = async (
  token: string,
): Promise<EmailConfirmation> => {
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

export function ConfirmEmail() {
  const result = useLoaderData({ from: "/confirm-email" });

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
