import { LogIn } from "lucide-react";
import { useSearch } from "@tanstack/react-router";
import { catalog } from "@empire-cleaning/models";
import { Button } from "@empire-cleaning/ui";
import { MessagePage } from "./MessagePage.tsx";
import { useSaid } from "./words.ts";

export type SignInLinkSearch = {
  token: string;
  callbackURL?: string;
  errorCallbackURL?: string;
};

// where the emailed sign-in link opens (#243). Mail scanners open links
// before the person does, and opening Better Auth's own would use it up, so
// only pressing Sign in sends the link's query on to Better Auth, which signs
// in and goes on to callbackURL, or back to sign-in with ?error=
const words = catalog({
  en: {
    title: "Sign in to Empire Cleaning",
    ready: "Your link is ready. Press Sign in to go on.",
  },
  es: {
    title: "Inicie sesión en Empire Cleaning",
    ready: "Su enlace está listo. Presione Iniciar sesión para continuar.",
  },
});

export function SignInLink() {
  const search = useSearch({ from: "/sign-in/link" });
  const { w, signIn } = useSaid(words);

  return (
    <MessagePage title={w.title} icon={LogIn}>
      <p className="text-fg-muted">{w.ready}</p>
      <form
        method="get"
        action="/api/auth/magic-link/verify"
        className="w-full"
      >
        {Object.entries(search).map(
          ([name, value]) =>
            value && (
              <input key={name} type="hidden" name={name} value={value} />
            ),
        )}
        <Button type="submit" className="w-full">
          {signIn}
        </Button>
      </form>
    </MessagePage>
  );
}
