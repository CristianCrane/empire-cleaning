import { useId, type ReactNode } from "react";
import { fieldStyles } from "./Field.tsx";

// A field whose input belongs to someone else, such as a payment provider's
// form in its own frame: it carries our label, explanation and error, while
// the input inside is theirs. By default it draws our field's box around a
// single input; tell it when that input has focus or is invalid, as only its
// owner knows. A form that draws its own boxes (themed to match ours) goes in
// unframed.
export function EmbeddedField({
  label,
  description,
  errorMessage,
  isFocused = false,
  framed = true,
  children,
}: {
  label: string;
  description?: string;
  errorMessage?: string;
  isFocused?: boolean;
  framed?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <span id={id} className="text-sm font-semibold text-fg">
        {label}
      </span>
      {description && (
        <span className="text-sm text-fg-muted">{description}</span>
      )}
      {framed ? (
        <div
          className={fieldStyles({
            isFocused,
            isInvalid: Boolean(errorMessage),
            className: "flex items-center py-3",
          })}
        >
          <div className="w-full">{children}</div>
        </div>
      ) : (
        <div className="w-full py-1">{children}</div>
      )}
      {errorMessage && (
        <span className="text-sm font-medium text-danger-strong">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
