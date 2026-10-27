import { Link } from "@empire-cleaning/ui";
import { linkTo } from "../links.ts";
import { MessagePage } from "./MessagePage.tsx";

// also what a record that isn't the person's shows: we don't say it exists
export function NotFound() {
  return (
    <MessagePage title="Page not found">
      <p className="text-fg-muted">
        That page doesn't exist.{" "}
        <Link href={linkTo({ to: "/" })}>Go to your home page</Link>.
      </p>
    </MessagePage>
  );
}
