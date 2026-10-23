import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
  type DialogProps as AriaDialogProps,
  type ModalOverlayProps,
} from "react-aria-components";
import type { ReactNode } from "react";

export { DialogTrigger } from "react-aria-components";

export type DialogProps = Omit<AriaDialogProps, "children"> & {
  title: string;
  children: ReactNode | ((opts: { close: () => void }) => ReactNode);
  // what the overlay passes through to the modal
  isDismissable?: ModalOverlayProps["isDismissable"];
};

// a modal dialog: a sheet rising from the bottom on a phone, centred on larger
// screens. Use inside a DialogTrigger after the Button that opens it, and end
// it with an <Actions> row. For a
// destructive confirmation, pass role="alertdialog" (not dismissable by tapping
// outside).
export function Dialog({
  title,
  children,
  isDismissable,
  ...props
}: DialogProps) {
  const isAlert = props.role === "alertdialog";

  return (
    <ModalOverlay
      isDismissable={isDismissable ?? !isAlert}
      className="fixed inset-0 z-50 flex items-end justify-center bg-backdrop entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out sm:items-center sm:p-4"
    >
      <Modal className="max-h-[90dvh] w-full overflow-auto rounded-t-xl bg-overlay text-fg shadow-overlay entering:animate-in entering:slide-in-from-bottom-8 exiting:animate-out exiting:slide-out-to-bottom-8 sm:max-w-md sm:rounded-lg">
        <AriaDialog
          {...props}
          className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none"
        >
          {({ close }) => (
            <>
              <Heading
                slot="title"
                className="font-display text-2xl font-bold tracking-wide uppercase"
              >
                {title}
              </Heading>
              {typeof children === "function" ? children({ close }) : children}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
