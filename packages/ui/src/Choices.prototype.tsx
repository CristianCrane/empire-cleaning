// PROTOTYPE: throwaway (#96, the quote form). Quieter choice controls: a
// segmented control for a short one-of choice and toggle chips for a
// many-of choice, so options don't each draw a full-width box.
import {
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  composeRenderProps,
  type CheckboxProps as AriaCheckboxProps,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
} from "react-aria-components";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Description, FieldError, Label } from "./Field.tsx";
import { composeTailwindRenderProps, focusRing, tv } from "./utils.ts";

export type SegmentedControlProps = Omit<AriaRadioGroupProps, "children"> & {
  label: string;
  description?: ReactNode;
  errorMessage?: string;
  children: ReactNode;
};

// one of a few short options, side by side in one tray
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

export type ChipGroupProps = {
  label: string;
  description?: ReactNode;
  errorMessage?: string;
  value: string[];
  onChange: (value: string[]) => void;
  children: ReactNode;
};

// any of several short options, as chips that wrap
export function ChipGroup({
  label,
  description,
  errorMessage,
  value,
  onChange,
  children,
}: ChipGroupProps) {
  return (
    <AriaCheckboxGroup
      value={value}
      onChange={onChange}
      isInvalid={!!errorMessage}
      className="flex flex-col gap-2"
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
