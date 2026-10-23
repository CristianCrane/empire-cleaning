import {
  Checkbox as AriaCheckbox,
  composeRenderProps,
  type CheckboxProps,
} from "react-aria-components";
import { Check, Minus } from "lucide-react";
import { composeTailwindRenderProps, focusRing, tv } from "./utils.ts";

const box = tv({
  extend: focusRing,
  base: "flex size-6 shrink-0 items-center justify-center rounded-sm border-2 transition-colors",
  variants: {
    isSelected: {
      false: "border-border-strong bg-surface",
      true: "border-primary bg-primary text-primary-fg",
    },
    isInvalid: { true: "border-danger" },
    isDisabled: { true: "opacity-50" },
  },
});

export function Checkbox(props: CheckboxProps) {
  return (
    <AriaCheckbox
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex min-h-touch items-center gap-3 text-base text-fg disabled:opacity-50",
      )}
    >
      {composeRenderProps(
        props.children,
        (children, { isSelected, isIndeterminate, ...renderProps }) => (
          <>
            <div
              className={box({
                ...renderProps,
                isSelected: isSelected || isIndeterminate,
              })}
            >
              {isIndeterminate ? (
                <Minus aria-hidden size={16} strokeWidth={3} />
              ) : isSelected ? (
                <Check aria-hidden size={16} strokeWidth={3} />
              ) : null}
            </div>
            {children}
          </>
        ),
      )}
    </AriaCheckbox>
  );
}
