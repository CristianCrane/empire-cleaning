import {
  Button as AriaButton,
  composeRenderProps,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { LoaderCircle } from "lucide-react";
import type { VariantProps } from "tailwind-variants";
import { focusRing, tv } from "./utils.ts";

export const buttonStyles = tv({
  extend: focusRing,
  base: "relative inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors disabled:opacity-50 pending:cursor-wait",
  variants: {
    variant: {
      primary:
        "bg-primary text-primary-fg hover:bg-primary-hover pressed:bg-primary-hover",
      // brand outlined, so it reads as clickable next to primary
      secondary:
        "border border-primary bg-surface text-primary hover:bg-primary/10 pressed:bg-primary/15",
      quiet:
        "bg-transparent text-fg hover:bg-surface-sunken pressed:bg-surface-sunken",
      // a secondary action on a Section or page, like Edit: reads as text in
      // the brand colour, tinted on hover. Lead it with an icon
      text: "bg-transparent text-primary hover:bg-primary/10 pressed:bg-primary/15",
      danger:
        "bg-danger text-danger-fg hover:bg-danger-hover pressed:bg-danger-hover",
    },
    size: {
      // every size stays a comfortable tap target except sm, for dense desktop tables
      md: "min-h-touch px-4 text-base",
      sm: "min-h-9 px-3 text-sm",
      icon: "size-touch",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export type ButtonProps = AriaButtonProps & VariantProps<typeof buttonStyles>;

// for an icon-only button, pass aria-label
export function Button({ variant, size, ...props }: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        buttonStyles({ ...renderProps, variant, size, className }),
      )}
    >
      {composeRenderProps(props.children, (children, { isPending }) => (
        <>
          {isPending && (
            <span className="absolute inset-0 flex items-center justify-center">
              <LoaderCircle aria-hidden className="animate-spin" size={20} />
            </span>
          )}
          {/* stays in place while pending, so the button keeps its width and
              screen readers keep its name */}
          <span
            className={`flex items-center gap-2 ${isPending ? "opacity-0" : ""}`}
          >
            {children}
          </span>
        </>
      ))}
    </AriaButton>
  );
}
