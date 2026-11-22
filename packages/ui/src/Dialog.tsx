import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
  type DialogProps as AriaDialogProps,
  type ModalOverlayProps,
} from "react-aria-components";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useUiWords } from "./language.ts";
import { Button } from "./Button.tsx";

export { DialogTrigger } from "react-aria-components";

export type DialogProps = Omit<AriaDialogProps, "children"> & {
  title: string;
  children: ReactNode | ((opts: { close: () => void }) => ReactNode);
  // what the overlay passes through to the modal
  isDismissable?: ModalOverlayProps["isDismissable"];
  // to open it from code rather than a DialogTrigger, e.g. when something is
  // dropped: whether it's open, and told when it closes
  isOpen?: ModalOverlayProps["isOpen"];
  onOpenChange?: ModalOverlayProps["onOpenChange"];
  // lg for a form with rows of choices, e.g. what a Site Visit found; wide
  // for something that needs the room, e.g. a week's calendar
  size?: "md" | "lg" | "wide";
};

// a modal dialog: a sheet rising from the bottom on a phone, centred on larger
// screens. Use inside a DialogTrigger after the Button that opens it (or pass
// isOpen and onOpenChange), and end it with an <Actions> row of at most two
// Buttons: one filled (primary, or danger for something destructive) and one
// quiet (Cancel, or an alternative such as Dismiss). The ✕ in its corner
// closes it without doing anything. Never open a dialog on a dialog: a second
// look is a step in the same one. For a destructive confirmation, pass
// role="alertdialog" (not dismissable by tapping outside). Its Actions row
// stays pinned at its foot while what's above it scrolls, read after the
// facts and always in reach, a phone's sheet and a centred dialog alike
// (docs/ux.md, Dialogs and rows).
export function Dialog({
  title,
  children,
  isDismissable,
  isOpen,
  onOpenChange,
  size = "md",
  ...props
}: DialogProps) {
  const isAlert = props.role === "alertdialog";

  const words = useUiWords();
  return (
    <ModalOverlay
      isDismissable={isDismissable ?? !isAlert}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="fixed inset-0 z-50 flex items-end justify-center bg-backdrop entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out sm:items-center sm:p-4"
    >
      <Modal
        // room for the pinned Actions under a field brought into view: two
        // Buttons stacked (a phone's), the most a dialog has, and the safe area
        className={`max-h-[90dvh] w-full overflow-auto scroll-pb-[calc(8.5rem+env(safe-area-inset-bottom))] rounded-t-xl bg-overlay text-fg shadow-overlay entering:animate-in entering:slide-in-from-bottom-8 exiting:animate-out exiting:slide-out-to-bottom-8 sm:rounded-lg ${{ md: "sm:max-w-md", lg: "sm:max-w-2xl", wide: "sm:max-w-6xl" }[size]}`}
      >
        <AriaDialog
          {...props}
          // its padding, and its Actions row (data-actions) pinned at its foot:
          // as wide as the dialog, over what scrolls under it, taking the
          // padding at the foot (the safe area's) as its own
          className="flex flex-col gap-4 p-5 pb-(--foot) outline-none [--foot:max(1.25rem,env(safe-area-inset-bottom))] [&_[data-actions]]:sticky [&_[data-actions]]:bottom-0 [&_[data-actions]]:z-10 [&_[data-actions]]:-mx-5 [&_[data-actions]]:-mb-(--foot) [&_[data-actions]]:border-t [&_[data-actions]]:border-border [&_[data-actions]]:bg-overlay [&_[data-actions]]:px-5 [&_[data-actions]]:pt-3 [&_[data-actions]]:pb-(--foot)"
        >
          {({ close }) => (
            <>
              <div className="flex items-start gap-3">
                <Heading
                  slot="title"
                  className="flex-1 font-display text-2xl font-bold tracking-wide uppercase"
                >
                  {title}
                </Heading>
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label={words.close}
                  onPress={close}
                  className="-mt-2 -mr-2 shrink-0"
                >
                  <X aria-hidden size={20} />
                </Button>
              </div>
              {typeof children === "function" ? children({ close }) : children}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
