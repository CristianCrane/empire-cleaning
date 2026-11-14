import { catalog } from "@empire-cleaning/models";
import type { ReactNode } from "react";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { QuoteRequestForm } from "@empire-cleaning/quote-request";
import {
  Button,
  FormPage,
  Notice,
  showToast,
  useLanguage,
} from "@empire-cleaning/ui";
import { forgetAccount, signOut } from "../session.ts";
import { quoteRequested } from "./QuoteParts.tsx";
import { useSaid } from "./words.ts";

const words = catalog({
  en: {
    signedInAs: (email: string) => `Signed in as ${email}`,
    next: "What happens next",
    tell: "You tell us about your home",
    tellText: "The rooms, how it's looking and when suits you.",
    email: "We email you a quote",
    emailText: "With the clean we'd recommend.",
    book: "You choose and book",
    bookText: "Pay the deposit here and your clean is booked.",
    otherEmail:
      "Asked us for a quote with a different email? Sign out and sign in with that one.",
  },
  es: {
    signedInAs: (email: string) => `Sesión iniciada como ${email}`,
    next: "Qué pasa después",
    tell: "Nos cuenta sobre su casa",
    tellText: "Las habitaciones, cómo está y cuándo le conviene.",
    email: "Le enviamos una cotización",
    emailText: "Con la limpieza que le recomendamos.",
    book: "Usted elige y reserva",
    bookText: "Pague el depósito aquí y su limpieza queda reservada.",
    otherEmail:
      "¿Nos pidió una cotización con otro correo electrónico? Cierre sesión e inicie sesión con ese.",
  },
});

// for an Account connected to nothing yet (ADR-0006): someone who signed up
// before asking for a Quote, or with a different email from their Quote
// Request. Asking for a Quote here makes them a Client. A Form page of its
// own: the form in its steps, what happens next beside it (UX pass, #96;
// #434)
export function Welcome() {
  const { account } = useRouteContext({ from: "/welcome" });
  const navigate = useNavigate();
  const lang = useLanguage();
  const t = useSaid(words);
  const { w, ASK_US } = t;

  return (
    <FormPage
      title={t.welcome}
      subtitle={ASK_US}
      account={
        <span className="flex items-center gap-2 text-sm text-fg-muted">
          {w.signedInAs(account.email)}
          <Button
            variant="text"
            size="sm"
            onPress={async () => {
              await signOut();
              void navigate({ to: "/sign-in" });
            }}
          >
            {t.signOut}
          </Button>
        </span>
      }
      aside={{
        title: w.next,
        children: (
          <>
            <ol className="flex flex-col gap-4">
              <Step n={1} title={w.tell}>
                {w.tellText}
              </Step>
              <Step n={2} title={w.email}>
                {w.emailText}
              </Step>
              <Step n={3} title={w.book}>
                {w.bookText}
              </Step>
            </ol>
            <Notice>{w.otherEmail}</Notice>
          </>
        ),
      }}
    >
      <QuoteRequestForm
        headingLevel={2}
        // signed up but not yet a Client, so no Preferred Language: the
        // app's, the signed-out language
        asker={{ kind: "account", email: account.email }}
        onSubmitted={async (receipt) => {
          // now a Client: the API connected this Account straight away
          forgetAccount();
          showToast(quoteRequested(lang, receipt.emailedTo));
          await navigate({ to: "/portal" });
        }}
      />
    </FormPage>
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
