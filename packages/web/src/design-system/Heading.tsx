import type { ReactNode } from "react";

import { tv } from "./utils.ts";

// page and section titles in the brand's condensed capitals; size 3 and
// below drop to the reading face so dense screens stay calm
const heading = tv({
  variants: {
    size: {
      1: "font-display text-3xl font-bold tracking-wide uppercase sm:text-4xl",
      2: "font-display text-2xl font-bold tracking-wide uppercase",
      3: "text-lg font-semibold",
      4: "text-base font-semibold",
    },
  },
});

type Level = 1 | 2 | 3 | 4;

export type HeadingProps = {
  // the place in the page outline (h1-h4); never skip a level
  level: Level;
  // how it looks, when that differs from its level
  size?: Level;
  id?: string;
  className?: string;
  children: ReactNode;
};

export function Heading({
  level,
  size,
  id,
  className,
  children,
}: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag id={id} className={heading({ size: size ?? level, className })}>
      {children}
    </Tag>
  );
}
