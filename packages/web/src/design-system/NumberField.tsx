import {
  Button as AriaButton,
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  type ValidationResult,
} from "react-aria-components";
import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Description, FieldError, FieldGroup, Input, Label } from "./Field.tsx";
import { composeTailwindRenderProps, focusRing } from "./utils.ts";

export type NumberFieldProps = AriaNumberFieldProps & {
  label: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
};

// for amounts and counts (prices, Labour Hours, Crew Size); pass formatOptions
// for currency, e.g. { style: "currency", currency: "USD" }
export function NumberField({
  label,
  description,
  errorMessage,
  ...props
}: NumberFieldProps) {
  return (
    <AriaNumberField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-1",
      )}
    >
      <Label>{label}</Label>
      <FieldGroup>
        <StepButton slot="decrement">
          <Minus aria-hidden size={18} />
        </StepButton>
        <Input className="min-h-0 min-w-0 flex-1 self-stretch rounded-none border-0 text-center tabular-nums outline-0" />
        <StepButton slot="increment">
          <Plus aria-hidden size={18} />
        </StepButton>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaNumberField>
  );
}

function StepButton(props: {
  slot: "increment" | "decrement";
  children: ReactNode;
}) {
  return (
    <AriaButton
      {...props}
      className={(renderProps) =>
        `${focusRing(renderProps)} flex w-touch shrink-0 items-center justify-center self-stretch text-fg-muted -outline-offset-2 hover:bg-surface-sunken hover:text-fg pressed:bg-surface-sunken disabled:opacity-50`
      }
    />
  );
}
