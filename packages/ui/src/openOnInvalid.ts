import { useContext, useEffect, useRef, useState } from "react";
import { FormValidationContext } from "react-aria-components";

/**
 * Something folded in a form (a part, fields behind a line) that opens to
 * show a field in it that's wrong: one the browser finds as the form's sent
 * (a required one left empty, through `onInvalidCapture` on its wrapper), or
 * one the API's errors mark invalid once they're given to the form (in the
 * wrapper at `ref`).
 */
export function useOpenOnInvalid(defaultOpen = false) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const errors = useContext(FormValidationContext);
  useEffect(() => {
    if (ref.current?.querySelector("[data-invalid]")) setOpen(true);
  }, [errors]);
  return { ref, open, setOpen, onInvalidCapture: () => setOpen(true) };
}
