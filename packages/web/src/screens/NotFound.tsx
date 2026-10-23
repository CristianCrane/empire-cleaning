import { Card, Heading, Link, Wordmark } from "@empire-cleaning/ui";
import { linkTo } from "../links.ts";

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Wordmark />
      <Card>
        <Heading level={1} size={2}>
          Page not found
        </Heading>
        <p className="text-fg-muted">
          That page doesn't exist.{" "}
          <Link href={linkTo({ to: "/" })}>Go to your home page</Link>.
        </p>
      </Card>
    </main>
  );
}
