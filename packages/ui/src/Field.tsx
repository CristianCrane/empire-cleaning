import {
  FieldError as AriaFieldError,
  Group as AriaGroup,
  Input as AriaInput,
  Label as AriaLabel,
  Text,
  TextArea as AriaTextArea,
  composeRenderProps,
  type FieldErrorProps,
  type GroupProps,
  type InputProps,
  type LabelProps,
  type TextAreaProps,
  type TextProps,
} from "react-aria-components";
import type { ReactNode } from "react";
import { composeTailwindRenderProps, tv, twMerge } from "./utils.ts";

// the building blocks every form control shares: a visible label, optional
// help text, and an error message announced to screen readers

export function Label(props: LabelProps) {
  return (
    <AriaLabel
      {...props}
      className={twMerge("text-sm font-semibold text-fg", props.className)}
    />
  );
}

export function Description(props: TextProps) {
  return (
    <Text
      {...props}
      slot="description"
      className={twMerge("text-sm text-fg-muted", props.className)}
    />
  );
}

export function FieldError(props: FieldErrorProps) {
  return (
    <AriaFieldError
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "text-sm font-medium text-balance text-danger-strong",
      )}
    />
  );
}

// How wide a field's box is: what it holds (docs/ux.md, Forms). Never more
// than a form's width, wherever it sits (a wide dialog, a wide card), as its
// label then sits far from where its answer goes; and from sm, a short
// answer's own width, by its longest answer, which also says what length is
// wanted: `short` (9rem) to about 8 characters, a ZIP code or a time;
// `medium` (13rem) to about 14, a phone, a day, a unit, a number or an
// amount; `long` (20rem) a few words, a Select's default. On a phone every
// field is full width, a thumb's target. Only the box: its label and
// description keep the row's width
export type FieldWidth = "form" | "short" | "medium" | "long";
const width = {
  form: "",
  short: "sm:max-w-36",
  medium: "sm:max-w-52",
  long: "sm:max-w-xs",
} satisfies Record<FieldWidth, string>;

// fields side by side, the row no wider than a form, so a short field's
// neighbour sits near it, not across a wide dialog (docs/ux.md, Forms):
// columns of 13rem or more, two to a row in a form's card, three in a
// wider one (a wide dialog), one on a phone. 13rem holds a number's − and + with its number
export function FieldRow({
  packed,
  children,
}: {
  // fields of a day's width or less, side by side at their answers' widths
  // from the row's start, as a date and its start time (the user, on #527:
  // "breaking symmetry and balance"), not spread across a card's columns
  packed?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid max-w-form gap-4 ${packed ? "grid-cols-1 sm:grid-cols-[repeat(auto-fill,13rem)]" : "grid-cols-[repeat(auto-fill,minmax(min(13rem,100%),1fr))]"}`}
    >
      {children}
    </div>
  );
}

// a text box: a tinted box with a line along its bottom, quieter than a full
// outline (#96); 16px text keeps phones from zooming in on focus
export const fieldStyles = tv({
  base: "min-h-touch w-full max-w-form rounded-md rounded-b-none border bg-surface-sunken px-3 text-base text-fg outline-none transition-colors placeholder:text-fg-muted",
  variants: {
    width,
    isFocused: { true: "outline-2 -outline-offset-1 outline-focus" },
    isInvalid: {
      true: "border-danger",
      false: "border-transparent border-b-border-strong",
    },
    isDisabled: { true: "opacity-50" },
  },
});

export function Input({
  width,
  ...props
}: InputProps & { width?: FieldWidth }) {
  return (
    <AriaInput
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        fieldStyles({ ...renderProps, width, className }),
      )}
    />
  );
}

export function TextArea(props: TextAreaProps) {
  return (
    <AriaTextArea
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        fieldStyles({ ...renderProps, className: `py-2 ${className ?? ""}` }),
      )}
    />
  );
}

// a field made of several parts (date segments, stepper buttons) in one
// box; parts stretch to its height rather than setting their own, so it
// matches a plain text box
const fieldGroupStyles = tv({
  base: "flex min-h-touch w-full max-w-form items-center overflow-hidden rounded-md rounded-b-none border bg-surface-sunken text-base text-fg",
  variants: {
    width,
    isFocusWithin: { true: "outline-2 -outline-offset-1 outline-focus" },
    isInvalid: {
      true: "border-danger",
      false: "border-transparent border-b-border-strong",
    },
    isDisabled: { true: "opacity-50" },
  },
});

export function FieldGroup({
  width,
  ...props
}: GroupProps & { width: FieldWidth }) {
  return (
    <AriaGroup
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        fieldGroupStyles({ ...renderProps, width, className }),
      )}
    />
  );
}
