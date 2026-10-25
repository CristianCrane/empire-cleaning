import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  composeRenderProps,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
  type ValidationResult,
} from "react-aria-components";
import type { ReactNode } from "react";
import { Description, FieldError, Label } from "./Field.tsx";
import { composeTailwindRenderProps, focusRing, tv } from "./utils.ts";

export type RadioGroupProps = Omit<AriaRadioGroupProps, "children"> & {
  label: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  children: ReactNode;
};

// a short list of choices, all visible at once (prefer Select for long lists);
// each option is a full-width tap target, optionally with its own explanation
export function RadioGroup({
  label,
  description,
  errorMessage,
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
      <div className="flex flex-col gap-2 orientation-horizontal:flex-row orientation-horizontal:flex-wrap">
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
