import type { ReactNode } from "react";
import type { LinkProps } from "react-aria-components";
import type { LucideIcon } from "lucide-react";
import { Card } from "../Card.tsx";
import { Heading } from "../Heading.tsx";
import { IconTile } from "../IconTile.tsx";
import { useUiWords } from "../language.ts";
import { Link } from "../Link.tsx";
import type { StatusTone } from "../StatusBadge.tsx";
import { PageFrame } from "./PageFrame.tsx";

// The Message page type's layouts (docs/ux.md, Screen types): one narrow
// card, in a PageFrame

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
    <PageFrame>
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
    </PageFrame>
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
    <PageFrame>
      <Card>
        <Heading level={1} size={2}>
          {title}
        </Heading>
        {children}
      </Card>
      {after}
    </PageFrame>
  );
}
