// PROTOTYPE: throwaway (#96, the quote form's type of home). One of a few
// options, each with an icon, drawn as tiles, pills or plain radios.
import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  composeRenderProps,
} from "react-aria-components";
import { Building2, House, Houses, Store, type LucideIcon } from "lucide-react";
import { Children, createContext, useContext, type ReactNode } from "react";
import { Description, FieldError, Label } from "./Field.tsx";
import { focusRing, tv } from "./utils.ts";

export type IconChoiceLook = "tile" | "pill" | "plain";

const icons: Record<string, LucideIcon> = {
  house: House,
  apartment: Building2,
  townhouse: Houses,
  commercial: Store,
};

const Look = createContext<IconChoiceLook>("tile");

export function IconChoiceGroup({
  label,
  description,
  errorMessage,
  look,
  value,
  onChange,
  name,
  children,
}: {
  label: string;
  description?: ReactNode;
  errorMessage?: string;
  look: IconChoiceLook;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  children: ReactNode;
}) {
  return (
    <AriaRadioGroup
      value={value}
      onChange={onChange}
      name={name}
      orientation="horizontal"
      className="flex flex-col gap-2"
    >
      <Label>{label}</Label>
      <div
        className={
          look === "tile"
            ? Children.count(children) === 4
              ? "grid grid-cols-2 gap-2 sm:grid-cols-4"
              : "grid grid-cols-3 gap-2"
            : look === "pill"
              ? "flex flex-wrap gap-2"
              : "flex flex-wrap gap-x-6 gap-y-2"
        }
      >
        <Look.Provider value={look}>{children}</Look.Provider>
      </div>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaRadioGroup>
  );
}

const styles = {
  tile: tv({
    extend: focusRing,
    base: "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg px-2 py-4 text-sm font-semibold transition-colors",
    variants: {
      isSelected: {
        false: "bg-surface-sunken text-fg hover:bg-neutral-subtle",
        true: "bg-success-subtle text-success-strong ring-2 ring-primary",
      },
    },
  }),
  pill: tv({
    extend: focusRing,
    base: "flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors",
    variants: {
      isSelected: {
        false: "bg-surface-sunken text-fg hover:bg-neutral-subtle",
        true: "bg-primary text-primary-fg",
      },
    },
  }),
  plain: tv({
    extend: focusRing,
    base: "flex min-h-touch cursor-pointer items-center gap-2 rounded text-base text-fg",
    variants: { isSelected: { false: "", true: "" } },
  }),
};

export function IconChoice({
  value,
  icon,
  children,
}: {
  value: string;
  // house, apartment, townhouse or commercial
  icon: string;
  children: ReactNode;
}) {
  const look = useContext(Look);
  const Icon = icons[icon] ?? House;
  return (
    <AriaRadio
      value={value}
      className={composeRenderProps("", (className, renderProps) =>
        styles[look]({ ...renderProps, className }),
      )}
    >
      {({ isSelected }) => (
        <>
          {look === "plain" && (
            <span
              aria-hidden
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? "border-primary after:size-2.5 after:rounded-full after:bg-primary" : "border-border-strong"}`}
            />
          )}
          <Icon
            aria-hidden
            size={look === "tile" ? 28 : 18}
            strokeWidth={look === "tile" ? 1.75 : 2}
            className={look === "plain" ? "text-fg-muted" : undefined}
          />
          {children}
        </>
      )}
    </AriaRadio>
  );
}
