import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { Button } from "@empire-cleaning/ui";
import { ApiError } from "../api.ts";
import { MessagePage } from "./MessagePage.tsx";
import { NotFound } from "./NotFound.tsx";

// the router's screen for a page that couldn't load. The API's 404 means the
// record doesn't exist or isn't the person's, and its 400 that the address
// is mangled (an id that isn't one): either way there's no such page. Anything
// else (a server error, the connection dropping) can be tried again. No
// details: they're no use to a Client.
export function PageError({ error }: ErrorComponentProps) {
  const router = useRouter();
  if (
    error instanceof ApiError &&
    (error.status === 404 || error.status === 400)
  ) {
    return <NotFound />;
  }

  return (
    <MessagePage title="Something went wrong" icon={CircleAlert} tone="warning">
      <p className="text-fg-muted">
        We couldn't load this page. Try again in a moment.
      </p>
      {/* re-running the loaders resets this screen once they succeed */}
      <Button onPress={() => void router.invalidate()}>Try again</Button>
    </MessagePage>
  );
}
