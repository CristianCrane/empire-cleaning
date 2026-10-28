import {
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  type ValidationResult,
} from "react-aria-components";
import { Description, FieldError, Input, Label, TextArea } from "./Field.tsx";
import type { FormEvent } from "react";
import { composeTailwindRenderProps } from "./utils.ts";

// React Aria checks a field again only when it's committed (on blur). Once a
// field shows an error, check it as they type, so the message goes as soon as
// it's fixed: going on blur, it moved the button being pressed (e.g. Next)
// out from under the pointer, and the press was lost.
const recheckWhileInvalid = (
  e: FormEvent<HTMLInputElement | HTMLTextAreaElement>,
) => {
  if (e.currentTarget.getAttribute("aria-invalid") === "true") {
    e.currentTarget.dispatchEvent(new Event("change", { bubbles: true }));
  }
};

export type TextFieldProps = AriaTextFieldProps & {
  label: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
  // a multi-line box, e.g. for Access Instructions
  multiline?: boolean;
};

export function TextField({
  label,
  description,
  errorMessage,
  placeholder,
  multiline,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-1",
      )}
    >
      <Label>{label}</Label>
      {multiline ? (
        <TextArea
          placeholder={placeholder}
          rows={4}
          onInput={recheckWhileInvalid}
        />
      ) : (
        <Input placeholder={placeholder} onInput={recheckWhileInvalid} />
      )}
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
}
