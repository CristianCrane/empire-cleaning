import { LogIn } from "lucide-react";
import { useSearch } from "@tanstack/react-router";
import { Button } from "@empire-cleaning/ui";
import { MessagePage } from "./MessagePage.tsx";

export type SignInLinkSearch = {
  token: string;
  callbackURL?: string;
  errorCallbackURL?: string;
};

// where the emailed sign-in link opens (#243). Mail scanners open links
// before the person does, and opening Better Auth's own would use it up, so
// only pressing Sign in sends the link's query on to Better Auth, which signs
// in and goes on to callbackURL, or back to sign-in with ?error=
export function SignInLink() {
  const search = useSearch({ from: "/sign-in/link" });

  return (
    <MessagePage title="Sign in to Empire Cleaning" icon={LogIn}>
      <p className="text-fg-muted">
        Your link is ready. Press Sign in to go on.
      </p>
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
          Sign in
        </Button>
      </form>
    </MessagePage>
  );
}
