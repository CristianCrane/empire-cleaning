import type { Ref } from "react";
import { Form as AriaForm, type FormProps } from "react-aria-components";
import { twMerge } from "./utils.ts";

// lays out fields in a single column, ending with an <Actions> row. Fields
// validate on submit and show their own errors; pass the API's field errors as
// validationErrors={{ email: "..." }}, and a ref to move the focus to one
export function Form(props: FormProps & { ref?: Ref<HTMLFormElement> }) {
  return (
    <AriaForm
      {...props}
      className={twMerge("flex flex-col gap-5", props.className)}
    />
  );
}
