import { composeRenderProps } from "react-aria-components";
import { extendTailwindMerge } from "tailwind-merge";
import { createTV } from "tailwind-variants";

// class merging that knows our own tokens (tokens.css), so a caller's
// "size-auto" really replaces a component's "size-touch". Components import
// tv and twMerge from here, never from the libraries directly.
const twMergeConfig = {
  extend: { theme: { spacing: ["touch"] } },
};

export const twMerge = extendTailwindMerge(twMergeConfig);

export const tv = createTV({ twMergeConfig });

// the keyboard focus ring every interactive component shares; React Aria only
// sets data-focus-visible for keyboard focus, so taps and clicks don't show it
export const focusRing = tv({
  base: "outline-2 outline-offset-2 outline-focus",
  variants: {
    isFocusVisible: {
      false: "outline-0",
      true: "outline-2",
    },
  },
});

// merges a caller's className into a component's own, for React Aria's
// className-as-function render props
export function composeTailwindRenderProps<T>(
  className: string | ((v: T) => string) | undefined,
  tw: string,
): string | ((v: T) => string) {
  return composeRenderProps(className, (className) => twMerge(tw, className));
}
