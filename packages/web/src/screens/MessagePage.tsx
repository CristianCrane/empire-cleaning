import { createContext, useContext, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  Heading,
  IconTile,
  Link,
  type StatusTone,
  Logo,
} from "@empire-cleaning/ui";
import { linkTo } from "../links.ts";

// true inside an area's layout, which already gives the page its frame
export const InArea = createContext(false);

// a page that's only a short message (not found, something went wrong):
// centred, an icon over it, at most one Button, and the way home a link
// under it all (UX pass, #96). In an area it sits in the layout, nav and
// all; anywhere else it's a page of its own
export function MessagePage({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone?: StatusTone;
  children: ReactNode;
}) {
  const card = (
    <Card>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <IconTile icon={icon} tone={tone} size="lg" />
        <Heading level={1} size={2}>
          {title}
        </Heading>
        {children}
        <Link href={linkTo({ to: "/" })}>Go to your home page</Link>
      </div>
    </Card>
  );
  if (useContext(InArea)) {
    return <div className="mx-auto max-w-md">{card}</div>;
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Logo className="mx-auto w-44" />
      {card}
    </main>
  );
}
