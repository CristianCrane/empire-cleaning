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
  showToast,
  Logo,
} from "@empire-cleaning/ui";
import { catalog } from "@empire-cleaning/models";
import { authClient } from "../session.ts";
import { GoogleButton } from "./GoogleButton.tsx";
import { useSaid } from "./words.ts";

// its words, in the language of the page the person came from (ADR-0025);
// what went wrong comes back from the API as a code on ?error=
const words = catalog({
  en: {
    errors: {
      INVALID_TOKEN:
        "That sign-in link has expired or has already been used. Enter your email below for a fresh one.",
    } as Record<string, string>,
    failed: "Signing in didn't work. Please try again.",
    another: "Another link is on its way",
    checkEmail: "Check your email",
    onItsWay: "A sign-in link is on its way to",
    worksOnce: "It works once, for 15 minutes.",
    notThere: "Not there? Check your spam folder, or send it again.",
    differentEmail: "Use a different email",
    sendAgain: "Send it again",
    or: "or",
    noPassword: "We'll email you a link that signs you in. No password needed.",
    emailMe: "Email me a sign-in link",
    newHere:
      "New to Empire Cleaning? Sign in with your email, then tell us about your home for a quote.",
  },
  es: {
    errors: {
      INVALID_TOKEN:
        "Ese enlace para iniciar sesión venció o ya se usó. Escriba su correo electrónico abajo para recibir uno nuevo.",
    },
    failed: "No se pudo iniciar sesión. Vuelva a intentarlo.",
    another: "Va en camino otro enlace",
    checkEmail: "Revise su correo",
    onItsWay: "Va en camino un enlace para iniciar sesión a",
    worksOnce: "Funciona una vez, durante 15 minutos.",
    notThere:
      "¿No le llegó? Revise la carpeta de correo no deseado, o envíelo de nuevo.",
    differentEmail: "Usar otro correo electrónico",
    sendAgain: "Enviarlo de nuevo",
    or: "o",
    noPassword:
      "Le enviaremos por correo un enlace para iniciar sesión. No necesita contraseña.",
    emailMe: "Enviarme un enlace para iniciar sesión",
    newHere:
      "¿Es nuevo en Empire Cleaning? Inicie sesión con su correo electrónico y luego cuéntenos sobre su casa para recibir una cotización.",
  },
});

export function SignIn() {
  const { next, error } = useSearch({ from: "/sign-in" });
  const { w, signIn, email } = useSaid(words);
  const [sentTo, setSentTo] = useState<string>();
  const [isSending, setSending] = useState(false);
  // why the link wasn't sent, when it wasn't
  const [sendFailed, setSendFailed] = useState<string>();

  // where sign-in links and Google return to: the page they asked for, or
  // back here (with ?error=) when something goes wrong
  const origin = window.location.origin;
  const callbackURL = `${origin}${next ?? "/"}`;
  const errorCallbackURL = `${origin}/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const sendLink = async (email: string, again = false) => {
    setSending(true);
    setSendFailed(undefined);
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL,
      errorCallbackURL,
    });
    setSending(false);
    if (error) {
      // asked too often for now (#32): the API says how long to wait
      setSendFailed(
        error.status === 429 && error.message ? error.message : w.failed,
      );
    } else {
      setSentTo(email);
      if (again) {
        showToast({ tone: "success", title: w.another });
      }
    }
  };

  // Google first: one tap for anyone with a Google account. The emailed
  // link under it, for everyone else (UX pass, #96)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Logo className="mx-auto w-44" />

      <Card>
        <Heading level={1} size={2}>
          {sentTo ? w.checkEmail : signIn}
        </Heading>

        {error && !sentTo && (
          <Notice tone="warning">{w.errors[error] ?? w.failed}</Notice>
        )}

        {sentTo ? (
          <>
            <div className="flex items-start gap-3">
              <IconTile icon={MailCheck} tone="success" />
              <p>
                {w.onItsWay} <strong>{sentTo}</strong>. {w.worksOnce}
              </p>
            </div>
            <p className="text-sm text-fg-muted">{w.notThere}</p>
            {sendFailed && <Notice tone="danger">{sendFailed}</Notice>}
            <Actions>
              <Button variant="text" onPress={() => setSentTo(undefined)}>
                {w.differentEmail}
              </Button>
              <Button
                variant="secondary"
                isPending={isSending}
                onPress={() => void sendLink(sentTo, true)}
              >
                {w.sendAgain}
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
              {w.or}
              <span className="h-px flex-1 bg-border" />
            </div>

            <p className="text-sm text-fg-muted">{w.noPassword}</p>
            {sendFailed && <Notice tone="danger">{sendFailed}</Notice>}
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                const email = new FormData(e.currentTarget).get("email");
                void sendLink(String(email));
              }}
            >
              <TextField
                label={email}
                name="email"
                type="email"
                autoComplete="email"
                isRequired
              />
              {/* full width: the form is narrow at every screen size */}
              <Button type="submit" isPending={isSending} className="w-full">
                {w.emailMe}
              </Button>
            </Form>
          </>
        )}
      </Card>

      {!sentTo && (
        <p className="text-center text-sm text-fg-muted">{w.newHere}</p>
      )}
    </main>
  );
}
