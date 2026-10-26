import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  composeRenderProps,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
  type ValidationResult,
} from "react-aria-components";
import { useId, type ReactNode } from "react";
import { Description, FieldError, Label } from "./Field.tsx";
import { composeTailwindRenderProps, focusRing, tv } from "./utils.ts";

export type RadioGroupProps = Omit<AriaRadioGroupProps, "children"> & {
  label: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  // "cards" lays RadioCards out side by side on wider screens
  layout?: "list" | "cards";
  children: ReactNode;
};

// a short list of choices, all visible at once (prefer Select for long lists);
// each option is a full-width tap target, optionally with its own explanation
export function RadioGroup({
  label,
  description,
  errorMessage,
  layout = "list",
  children,
  ...props
}: RadioGroupProps) {
  return (
    <AriaRadioGroup
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-2",
      )}
    >
      <Label>{label}</Label>
      {description && <Description>{description}</Description>}
      <div
        className={
          layout === "cards"
            ? "grid gap-4 lg:grid-cols-2"
            : "flex flex-col gap-2 orientation-horizontal:flex-row orientation-horizontal:flex-wrap"
        }
      >
        {children}
      </div>
      <FieldError>{errorMessage}</FieldError>
    </AriaRadioGroup>
  );
}

const option = tv({
  extend: focusRing,
  base: "flex min-h-touch items-start gap-3 rounded-md border px-3 py-2.5 text-base transition-colors",
  variants: {
    isSelected: {
      false: "border-border-strong bg-surface hover:bg-surface-sunken",
      true: "border-primary bg-success-subtle",
    },
    isInvalid: { true: "border-danger" },
    isDisabled: { true: "opacity-50" },
  },
});

const dot = tv({
  base: "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
  variants: {
    isSelected: {
      false: "border-border-strong",
      true: "border-primary after:size-2.5 after:rounded-full after:bg-primary",
    },
  },
});

export type RadioProps = Omit<AriaRadioProps, "children"> & {
  children: ReactNode;
  // a line under the option explaining it, e.g. what "moderate" means
  description?: string;
};

export function Radio({ children, description, ...props }: RadioProps) {
  return (
    <AriaRadio
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        option({ ...renderProps, className }),
      )}
    >
      {({ isSelected }) => (
        <>
          <span aria-hidden className={dot({ isSelected })} />
          <span className="flex flex-col">
            <span className="font-semibold text-fg">{children}</span>
            {description && (
              <span className="text-sm text-fg-muted">{description}</span>
            )}
          </span>
        </>
      )}
    </AriaRadio>
  );
}

const card = tv({
  extend: focusRing,
  base: "flex cursor-pointer flex-col gap-3 rounded-lg border-2 bg-surface p-4 text-fg shadow-raised transition-colors sm:p-5",
  variants: {
    isSelected: {
      false: "border-border hover:border-border-strong",
      true: "border-primary",
    },
    isInvalid: { true: "border-danger" },
    isDisabled: { true: "cursor-default opacity-50" },
  },
});

export type RadioCardProps = Omit<AriaRadioProps, "children"> & {
  // the choice's name, which is how it's announced
  title: string;
  // beside the title, e.g. a StatusBadge
  badge?: ReactNode;
  // what the choice means, read out after its name; nothing interactive,
  // since the whole card is the control
  children?: ReactNode;
};

// a choice shown as a card, for options that need more than a line to
// compare (e.g. prices); put them in a RadioGroup with layout="cards"
export function RadioCard({
  title,
  badge,
  children,
  ...props
}: RadioCardProps) {
  const detailsId = useId();
  return (
    <AriaRadio
      {...props}
      aria-label={title}
      aria-describedby={children ? detailsId : undefined}
      className={composeRenderProps(props.className, (className, renderProps) =>
        card({ ...renderProps, className }),
      )}
    >
      {({ isSelected }) => (
        <>
          <span className="flex items-start gap-3">
            <span aria-hidden className={dot({ isSelected })} />
            <span className="flex-1 font-display text-lg font-semibold">
              {title}
            </span>
            {badge}
          </span>
          {children && (
            <span id={detailsId} className="flex flex-col gap-3">
              {children}
            </span>
          )}
        </>
      )}
    </AriaRadio>
  );
}
