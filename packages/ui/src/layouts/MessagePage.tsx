import { useContext, type ReactNode } from "react";
import type { LinkProps } from "react-aria-components";
import type { LucideIcon } from "lucide-react";
import { Card } from "../Card.tsx";
import { Heading } from "../Heading.tsx";
import { IconTile } from "../IconTile.tsx";
import { useUiWords } from "../language.ts";
import { Link } from "../Link.tsx";
import { Logo } from "../Logo.tsx";
import type { StatusTone } from "../StatusBadge.tsx";
import { InAppLayout } from "./AppLayout.tsx";

// The Message page type's layouts (docs/ux.md, Screen types): one narrow
// card. In an area it sits in AppLayout's frame, nav and all; anywhere else
// it's a page of its own, centred, the logo above it (UX pass, #96; #168)
function Frame({ card, after }: { card: ReactNode; after?: ReactNode }) {
  if (useContext(InAppLayout)) {
    return <div className="mx-auto max-w-md">{card}</div>;
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <Logo className="mx-auto w-44" />
      {card}
      {after}
    </main>
  );
}

// a page that's only a short message (not found, something went wrong):
// centred under a large icon, at most one Button, and the way home a link
// under it all
export function MessagePage({
  title,
  icon,
  tone,
  home,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone?: StatusTone;
  // the person's home page, as the app's router links to it
  home: NonNullable<LinkProps["href"]>;
  children: ReactNode;
}) {
  const words = useUiWords();
  return (
    <Frame
      card={
        <Card>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <IconTile icon={icon} tone={tone} size="lg" />
            <Heading level={1} size={2}>
              {title}
            </Heading>
            {children}
            <Link href={home}>{words.goHome}</Link>
          </div>
        </Card>
      }
    />
  );
}

// signing in: the form in the card under its title, and a line for someone
// new under the card
export function SignInPage({
  title,
  after,
  children,
}: {
  title: string;
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Frame
      card={
        <Card>
          <Heading level={1} size={2}>
            {title}
          </Heading>
          {children}
        </Card>
      }
      after={after}
    />
  );
}
