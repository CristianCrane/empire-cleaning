import {
  Button as AriaButton,
  ListBox,
  ListBoxItem,
  Select as AriaSelect,
  SelectValue,
  composeRenderProps,
  type ListBoxItemProps,
  type SelectProps as AriaSelectProps,
  type ValidationResult,
} from "react-aria-components";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Description, FieldError, Label, fieldStyles } from "./Field.tsx";
import { Popover } from "./Popover.tsx";
import { composeTailwindRenderProps } from "./utils.ts";

export type SelectProps<T extends object> = Omit<
  AriaSelectProps<T>,
  "children"
> & {
  label: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  items?: Iterable<T>;
  children: ReactNode | ((item: T) => ReactNode);
};

export function Select<T extends object>({
  label,
  description,
  errorMessage,
  items,
  children,
  ...props
}: SelectProps<T>) {
  return (
    <AriaSelect
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-1",
      )}
    >
      {({ isInvalid, isDisabled }) => (
        <>
          <Label>{label}</Label>
          <AriaButton
            className={(renderProps) =>
              fieldStyles({
                isFocused: renderProps.isFocusVisible || renderProps.isPressed,
                isInvalid,
                isDisabled,
                className: "flex items-center gap-2 text-left",
              })
            }
          >
            <SelectValue className="flex-1 truncate placeholder-shown:text-fg-muted" />
            <ChevronDown aria-hidden size={18} className="text-fg-muted" />
          </AriaButton>
          {description && <Description>{description}</Description>}
          <FieldError>{errorMessage}</FieldError>
          <Popover className="min-w-(--trigger-width)">
            <ListBox items={items} className="max-h-72 p-1 outline-none">
              {children}
            </ListBox>
          </Popover>
        </>
      )}
    </AriaSelect>
  );
}

export function SelectItem(props: ListBoxItemProps) {
  const textValue =
    props.textValue ??
    (typeof props.children === "string" ? props.children : undefined);

  return (
    <ListBoxItem
      {...props}
      textValue={textValue}
      className="flex min-h-touch cursor-default items-center gap-2 rounded-md px-3 text-base text-fg outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken focused:bg-surface-sunken selected:font-semibold"
    >
      {composeRenderProps(props.children, (children, { isSelected }) => (
        <>
          <span className="flex-1">{children}</span>
          {isSelected && (
            <Check aria-hidden size={18} className="text-primary" />
          )}
        </>
      ))}
    </ListBoxItem>
  );
}
