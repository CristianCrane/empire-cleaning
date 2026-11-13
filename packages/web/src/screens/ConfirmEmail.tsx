import { useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { Mail, MailCheck, MailX } from "lucide-react";
import { catalog } from "@empire-cleaning/models";
import {
  Button,
  ButtonLink,
  MessagePage,
  Notice,
  useLanguage,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../api.ts";
import { linkTo } from "../links.ts";
import { reportUnexpected } from "../monitoring.ts";

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

const words = catalog({
  en: {
    title: "Confirm your new email",
    text: "Confirm it's yours, and we'll send your quotes and notices there.",
    failed: "Confirming didn't work. Please try again.",
    confirm: "Confirm my email",
    confirmed: "Email confirmed",
    sendTo: (email: string) =>
      `We'll send your quotes and notices to ${email}.`,
    notChanged: "Email not changed",
    again: "Change it again",
  },
  es: {
    title: "Confirme su nuevo correo electrónico",
    text: "Confirme que es suyo y le enviaremos allí sus cotizaciones y avisos.",
    failed: "No se pudo confirmar. Vuelva a intentarlo.",
    confirm: "Confirmar mi correo electrónico",
    confirmed: "Correo electrónico confirmado",
    sendTo: (email: string) =>
      `Le enviaremos sus cotizaciones y avisos a ${email}.`,
    notChanged: "No se cambió el correo electrónico",
    again: "Cambiarlo de nuevo",
  },
});

// opening the link changes nothing: mail scanners open links before the
// person does, so only the button confirms it (#243)
export function ConfirmEmail() {
  const { token } = useSearch({ from: "/confirm-email" });
  const [result, setResult] = useState<EmailConfirmation>();
  const [isPending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const w = words[useLanguage()];
  const home = linkTo({ to: "/" });

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
      <MessagePage title={w.title} icon={Mail} home={home}>
        <p className="text-fg-muted">{w.text}</p>
        {failed && <Notice tone="danger">{w.failed}</Notice>}
        <Button
          isPending={isPending}
          onPress={() => void confirm()}
          className="w-full"
        >
          {w.confirm}
        </Button>
      </MessagePage>
    );
  }
  if (result.confirmed) {
    return (
      <MessagePage
        title={w.confirmed}
        icon={MailCheck}
        tone="success"
        home={home}
      >
        <p className="text-fg-muted [overflow-wrap:anywhere]">
          {w.sendTo(result.email)}
        </p>
      </MessagePage>
    );
  }
  return (
    <MessagePage title={w.notChanged} icon={MailX} tone="danger" home={home}>
      <p className="text-fg-muted">{result.problem}</p>
      <ButtonLink href={linkTo({ to: "/portal/details" })}>
        {w.again}
      </ButtonLink>
    </MessagePage>
  );
}
