import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  composeRenderProps,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
} from "react-aria-components";
import type { ReactNode } from "react";
import { Description, FieldError, Label } from "./Field.tsx";
import { composeTailwindRenderProps, focusRing, tv } from "./utils.ts";

export type SegmentedControlProps = Omit<
  AriaRadioGroupProps,
  "children" | "orientation"
> & {
  label: string;
  // under the tray, e.g. what the picked option means
  description?: ReactNode;
  errorMessage?: string;
  children: ReactNode;
};

// one of two to four short options, side by side in one tray: a radio group
// that draws no box per option (#96). For longer labels, or options that
// each need explaining, use RadioGroup.
export function SegmentedControl({
  label,
  description,
  errorMessage,
  children,
  ...props
}: SegmentedControlProps) {
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
      <div className="flex gap-1 rounded-md bg-surface-sunken p-1">
        {children}
      </div>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaRadioGroup>
  );
}

const segment = tv({
  extend: focusRing,
  base: "flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded px-3 text-center text-sm font-semibold transition-colors",
  variants: {
    isSelected: {
      false: "text-fg-muted hover:text-fg",
      true: "bg-surface text-fg shadow-raised",
    },
    isDisabled: { true: "cursor-default opacity-50" },
  },
});

export function Segment(props: Omit<AriaRadioProps, "className">) {
  return (
    <AriaRadio
      {...props}
      className={composeRenderProps("", (className, renderProps) =>
        segment({ ...renderProps, className }),
      )}
    />
  );
}
