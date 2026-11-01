import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  composeRenderProps,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
} from "react-aria-components";
import type { LucideIcon } from "lucide-react";
import { Children, type ReactNode } from "react";
import { Description, FieldError, Label } from "./Field.tsx";
import { composeTailwindRenderProps, focusRing, tv } from "./utils.ts";

export type ChoiceTilesProps = Omit<
  AriaRadioGroupProps,
  "children" | "orientation"
> & {
  label: string;
  description?: ReactNode;
  errorMessage?: string;
  children: ReactNode;
};

// one of a few things that are easiest told apart by a picture, as tiles
// with an icon over a short name (#96), e.g. what needs cleaning. Three sit
// in a row; four sit two by two on a phone; more sit two to a row on a phone
// and three on a wider screen. A short last row's tiles grow to fill it, so
// no row ends in a gap.
export function ChoiceTiles({
  label,
  description,
  errorMessage,
  children,
  ...props
}: ChoiceTilesProps) {
  return (
    <AriaRadioGroup
      {...props}
      orientation="horizontal"
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-2",
      )}
    >
      <Label>{label}</Label>
      {/* only the tiles: a tile left out (`{cond && <ChoiceTile>}`) isn't one */}
      <div className={tileRows(Children.toArray(children).length)}>
        {children}
      </div>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaRadioGroup>
  );
}

// `count` tiles in rows, each tile's share of a full row less its share of
// the gaps (gap-2); a short last row's tiles grow to fill it
const tileRows = (count: number) =>
  `flex flex-wrap gap-2 [&>*]:grow ${
    count === 3
      ? "[&>*]:basis-[calc((100%_-_1rem)/3)]"
      : count === 4
        ? "[&>*]:basis-[calc((100%_-_0.5rem)/2)] sm:[&>*]:basis-[calc((100%_-_1.5rem)/4)]"
        : "[&>*]:basis-[calc((100%_-_0.5rem)/2)] sm:[&>*]:basis-[calc((100%_-_1rem)/3)]"
  }`;

// ChoiceTiles while their choices load: the label and `count` blank tiles,
// each the size of a real one, so nothing moves when the choices arrive
export function ChoiceTilesLoading({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <span className="text-sm font-semibold text-fg">{label}</span>
      <div className={tileRows(count)} aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="flex animate-pulse flex-col items-center justify-center gap-2 rounded-lg bg-surface-sunken px-2 py-4 text-sm font-semibold"
          >
            {/* an icon's and a name's room */}
            <span className="size-7" />
            <span>&nbsp;</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const tile = tv({
  extend: focusRing,
  base: "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg px-2 py-4 text-center text-sm font-semibold transition-colors",
  variants: {
    isSelected: {
      false: "bg-surface-sunken text-fg hover:bg-neutral-subtle",
      true: "bg-success-subtle text-success-strong ring-2 ring-primary",
    },
    isDisabled: { true: "cursor-default opacity-50" },
  },
});

export function ChoiceTile({
  icon: Icon,
  children,
  ...props
}: Omit<AriaRadioProps, "className" | "children"> & {
  // decorative: the name says what it is
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <AriaRadio
      {...props}
      className={composeRenderProps("", (className, renderProps) =>
        tile({ ...renderProps, className }),
      )}
    >
      <Icon aria-hidden size={28} strokeWidth={1.75} />
      {children}
    </AriaRadio>
  );
}
