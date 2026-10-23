import {
  DateInput,
  DatePicker as AriaDatePicker,
  DateSegment,
  Dialog,
  TimeField as AriaTimeField,
  type DatePickerProps as AriaDatePickerProps,
  type DateValue,
  type TimeFieldProps as AriaTimeFieldProps,
  type TimeValue,
  type ValidationResult,
} from "react-aria-components";
import { CalendarDays } from "lucide-react";
import { Button } from "./Button.tsx";
import { Calendar } from "./Calendar.tsx";
import { Description, FieldError, FieldGroup, Label } from "./Field.tsx";
import { Popover } from "./Popover.tsx";
import { composeTailwindRenderProps } from "./utils.ts";

type FieldText = {
  label: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
};

// dates and times are typed segment by segment (keyboard and screen-reader
// friendly) and formatted for the viewer's locale; values come from
// @internationalized/date, e.g. parseDate("2026-11-02") or new Time(9, 30)
function Segments() {
  return (
    <DateInput className="flex flex-1 px-3 tabular-nums">
      {(segment) => (
        <DateSegment
          segment={segment}
          className="rounded-sm px-0.5 outline-none type-literal:px-0 placeholder-shown:text-fg-muted focused:bg-primary focused:text-primary-fg"
        />
      )}
    </DateInput>
  );
}

export type DatePickerProps<T extends DateValue> = AriaDatePickerProps<T> &
  FieldText;

export function DatePicker<T extends DateValue>({
  label,
  description,
  errorMessage,
  ...props
}: DatePickerProps<T>) {
  return (
    <AriaDatePicker
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-1",
      )}
    >
      <Label>{label}</Label>
      <FieldGroup>
        <Segments />
        <Button
          variant="quiet"
          size="icon"
          className="size-auto w-touch self-stretch rounded-none -outline-offset-2"
        >
          <CalendarDays aria-hidden size={20} />
        </Button>
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover>
        <Dialog className="p-3 outline-none">
          <Calendar />
        </Dialog>
      </Popover>
    </AriaDatePicker>
  );
}

export type TimeFieldProps<T extends TimeValue> = AriaTimeFieldProps<T> &
  FieldText;

export function TimeField<T extends TimeValue>({
  label,
  description,
  errorMessage,
  ...props
}: TimeFieldProps<T>) {
  return (
    <AriaTimeField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        "flex flex-col gap-1",
      )}
    >
      <Label>{label}</Label>
      <FieldGroup>
        <Segments />
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaTimeField>
  );
}
