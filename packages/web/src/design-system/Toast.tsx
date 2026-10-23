import {
  Button as AriaButton,
  Text,
  // React Aria still marks toasts unstable; only this file touches that API
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastQueue as AriaToastQueue,
  UNSTABLE_ToastRegion as AriaToastRegion,
} from "react-aria-components";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { focusRing, tv } from "./utils.ts";

export type ToastContent = {
  title: string;
  description?: string;
  tone?: "info" | "success" | "danger";
};

export const toastQueue = new AriaToastQueue<ToastContent>({
  maxVisibleToasts: 3,
});

// brief confirmation of something that already happened ("Quote sent").
// Anything the person must act on belongs on the page, not in a toast.
export const showToast = (content: ToastContent) =>
  toastQueue.add(content, { timeout: 5000 });

const icons = { info: Info, success: CircleCheck, danger: CircleAlert };

const accent = tv({
  base: "mt-0.5 shrink-0",
  variants: {
    tone: {
      info: "text-info-strong",
      success: "text-success-strong",
      danger: "text-danger-strong",
    },
  },
});

// render once, at the root of the app
export function ToastRegion() {
  return (
    <AriaToastRegion
      queue={toastQueue}
      className="fixed inset-x-4 top-4 z-50 flex flex-col gap-2 outline-none sm:inset-x-auto sm:top-auto sm:right-4 sm:bottom-4 sm:w-96"
    >
      {({ toast }) => {
        const tone = toast.content.tone ?? "info";
        const Icon = icons[tone];
        return (
          <AriaToast
            toast={toast}
            className={(renderProps) =>
              `${focusRing(renderProps)} flex items-start gap-3 rounded-lg border border-border bg-overlay p-4 text-fg shadow-overlay`
            }
          >
            <Icon aria-hidden size={20} className={accent({ tone })} />
            <AriaToastContent className="flex min-w-0 flex-1 flex-col">
              <Text slot="title" className="font-semibold">
                {toast.content.title}
              </Text>
              {toast.content.description && (
                <Text slot="description" className="text-sm text-fg-muted">
                  {toast.content.description}
                </Text>
              )}
            </AriaToastContent>
            <AriaButton
              slot="close"
              aria-label="Dismiss"
              className={(renderProps) =>
                `${focusRing(renderProps)} -m-2 flex size-touch shrink-0 items-center justify-center rounded-md text-fg-muted hover:text-fg`
              }
            >
              <X aria-hidden size={18} />
            </AriaButton>
          </AriaToast>
        );
      }}
    </AriaToastRegion>
  );
}
