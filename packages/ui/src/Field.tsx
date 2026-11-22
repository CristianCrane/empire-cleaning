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
        "text-sm font-medium text-danger-strong",
      )}
    />
  );
}

// How wide a field's box is: what it holds (docs/ux.md, Forms). Never more
// than a form's width, wherever it sits (a wide dialog, a wide card), as its
// label then sits far from where its answer goes; and from sm, a short
// answer's own width, which also says what length is wanted: `short` a ZIP
// code or a time, `medium` a phone, a day, a count or an amount, `long` a
// choice of a few words. On a phone every field is full width, a thumb's
// target. Only the box: its label and description keep the row's width
export type FieldWidth = "form" | "short" | "medium" | "long";
const width = {
  form: "",
  short: "sm:max-w-36",
  medium: "sm:max-w-52",
  long: "sm:max-w-xs",
} satisfies Record<FieldWidth, string>;

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
