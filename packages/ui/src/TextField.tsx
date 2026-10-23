import {
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  type ValidationResult,
} from "react-aria-components";
import { Description, FieldError, Input, Label, TextArea } from "./Field.tsx";
import { composeTailwindRenderProps } from "./utils.ts";

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
        <TextArea placeholder={placeholder} rows={4} />
      ) : (
        <Input placeholder={placeholder} />
      )}
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
}
