import { createContext, useContext, type ReactNode } from "react";
import { Card, Heading, Wordmark } from "@empire-cleaning/ui";

// true inside an area's layout, which already gives the page its frame
export const InArea = createContext(false);

// a page that's only a short message (not found, something went wrong). In an
// area it sits in the layout, nav and all; anywhere else it's a page of its own
export function MessagePage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const card = (
    <Card>
      <Heading level={1} size={2}>
        {title}
      </Heading>
      {children}
    </Card>
  );
  if (useContext(InArea)) {
    return <div className="mx-auto max-w-md">{card}</div>;
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Wordmark />
      {card}
    </main>
  );
}
