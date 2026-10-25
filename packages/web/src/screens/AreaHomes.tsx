import { Card, Heading } from "@empire-cleaning/ui";

// the Cleaner area's first screen, empty until its feature tickets fill it in

export function CleanerHome() {
  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Today</Heading>
      <Card>
        <p className="text-fg-muted">No Jobs today.</p>
      </Card>
    </div>
  );
}
