import {
  LANGUAGES,
  type Language,
  languageNames,
} from "@empire-cleaning/models";
import {
  Segment,
  SegmentedControl,
  type SegmentedControlProps,
} from "./SegmentedControl.tsx";

// a language named in its own words, marked as that language, wherever one
// is shown or picked (ADR-0025): "Español" on an English screen
export function LanguageName({ language }: { language: Language }) {
  return <span lang={language}>{languageNames[language]}</span>;
}

// a person's Preferred Language, as the Office sets it (ADR-0025), so its
// label and description are the Office's English
export function LanguagePicker({
  label = "Preferred language",
  description = "Their screens and emails come in it.",
  onChange,
  ...props
}: Omit<SegmentedControlProps, "children" | "onChange" | "label"> & {
  label?: string;
  onChange?: (language: Language) => void;
}) {
  return (
    <SegmentedControl
      {...props}
      label={label}
      description={description}
      onChange={(value) => onChange?.(value as Language)}
    >
      {LANGUAGES.map((lang) => (
        <Segment key={lang} value={lang}>
          <LanguageName language={lang} />
        </Segment>
      ))}
    </SegmentedControl>
  );
}
