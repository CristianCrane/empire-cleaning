import { Card, Heading } from "@empire-cleaning/ui";

// each area's first screen, empty until the feature tickets fill it in

export function OfficeHome() {
  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Today</Heading>
      <Card>
        <p className="text-fg-muted">Nothing needs attention right now.</p>
      </Card>
    </div>
  );
}

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
