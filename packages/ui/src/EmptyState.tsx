import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "./Card.tsx";
import { Heading } from "./Heading.tsx";
import { IconTile } from "./IconTile.tsx";

export type EmptyStateProps = {
  icon: LucideIcon;
  // what's missing, e.g. "This Property doesn't have a Service Plan"
  title: string;
  // why, or what adding one does
  description?: ReactNode;
  // the way to add it, usually one primary Button; or a Notice saying why
  // it can't be added just now
  children?: ReactNode;
  // the title's place in the page outline
  headingLevel?: 2 | 3 | 4;
};

// a place on a page with nothing in it yet: says what's missing and offers
// the action that adds it
export function EmptyState({
  icon,
  title,
  description,
  children,
  headingLevel = 2,
}: EmptyStateProps) {
  return (
    <Card className="items-center py-10 text-center">
      <IconTile icon={icon} />
      <div className="flex max-w-md flex-col gap-1">
        <Heading level={headingLevel} size={4}>
          {title}
        </Heading>
        {description && <p className="text-fg-muted">{description}</p>}
      </div>
      {children && (
        <div className="flex flex-wrap justify-center gap-2">{children}</div>
      )}
    </Card>
  );
}
