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

// a person's Preferred Language, as the Office sets it (ADR-0025): each
// language named in its own words, as everywhere a language is picked
export function LanguagePicker({
  onChange,
  ...props
}: Omit<SegmentedControlProps, "children" | "onChange"> & {
  onChange?: (language: Language) => void;
}) {
  return (
    <SegmentedControl
      {...props}
      onChange={(value) => onChange?.(value as Language)}
    >
      {LANGUAGES.map((lang) => (
        <Segment key={lang} value={lang}>
          <span lang={lang}>{languageNames[lang]}</span>
        </Segment>
      ))}
    </SegmentedControl>
  );
}
