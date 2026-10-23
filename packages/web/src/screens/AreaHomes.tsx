import { useRouteContext } from "@tanstack/react-router";
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

export function PortalHome() {
  const { account } = useRouteContext({ from: "/portal" });
  const [firstName] = account.name.split(" ");

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Welcome, {firstName}</Heading>
      <Card>
        <p className="text-fg-muted">
          Your Quotes, Jobs and Service Plans will appear here.
        </p>
      </Card>
    </div>
  );
}
