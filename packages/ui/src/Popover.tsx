import {
  Popover as AriaPopover,
  type PopoverProps,
} from "react-aria-components";
import { composeTailwindRenderProps } from "./utils.ts";

// the floating panel under a Select or date picker
export function Popover(props: PopoverProps) {
  return (
    <AriaPopover
      offset={4}
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "overflow-auto rounded-lg border border-border bg-overlay text-fg shadow-overlay outline-none entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95",
      )}
    />
  );
}
