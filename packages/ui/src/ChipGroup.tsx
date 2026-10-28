import {
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  composeRenderProps,
  type CheckboxGroupProps as AriaCheckboxGroupProps,
  type CheckboxProps as AriaCheckboxProps,
} from "react-aria-components";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Description, FieldError, Label } from "./Field.tsx";
import { composeTailwindRenderProps, focusRing, tv } from "./utils.ts";

export type ChipGroupProps = Omit<AriaCheckboxGroupProps, "children"> & {
  label: string;
  description?: ReactNode;
  errorMessage?: string;
  children: ReactNode;
};

// any of several short options, as chips that wrap: a checkbox group that
// draws no row per option (#96), e.g. extras or weekdays
export function ChipGroup({
  label,
  description,
  errorMessage,
  children,
  ...props
}: ChipGroupProps) {
  return (
    <AriaCheckboxGroup
      {...props}
      isInvalid={props.isInvalid || !!errorMessage}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-2",
      )}
    >
      <Label>{label}</Label>
      {description && <Description>{description}</Description>}
      <div className="flex flex-wrap gap-2">{children}</div>
      <FieldError>{errorMessage}</FieldError>
    </AriaCheckboxGroup>
  );
}

const chip = tv({
  extend: focusRing,
  base: "flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors",
  variants: {
    isSelected: {
      false: "bg-surface-sunken text-fg hover:bg-neutral-subtle",
      true: "bg-primary text-primary-fg",
    },
    isDisabled: { true: "cursor-default opacity-50" },
  },
});

export function Chip({
  children,
  ...props
}: Omit<AriaCheckboxProps, "className" | "children"> & {
  children: ReactNode;
}) {
  return (
    <AriaCheckbox
      {...props}
      className={composeRenderProps("", (className, renderProps) =>
        chip({ ...renderProps, className }),
      )}
    >
      {({ isSelected }) => (
        <>
          {isSelected && <Check aria-hidden size={14} strokeWidth={3} />}
          {children}
        </>
      )}
    </AriaCheckbox>
  );
}
