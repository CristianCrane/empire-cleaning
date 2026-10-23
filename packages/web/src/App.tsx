import type { AccountRole } from "@empire-cleaning/models";
import { Card, Heading, Wordmark } from "@empire-cleaning/ui";

// each role has its own area of the app; sign-in and the areas themselves
// arrive with #19
const areas: Record<AccountRole, string> = {
  office_staff: "Office",
  cleaner: "Cleaner",
  client: "Client portal",
};

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Wordmark />
      <Card>
        <Heading level={1}>Coming soon</Heading>
        <p className="text-fg-muted">
          {Object.values(areas).join(", ")}: on their way.
        </p>
      </Card>
    </main>
  );
}
