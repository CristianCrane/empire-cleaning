// the design system (@empire-cleaning/ui): import components from here, never from
// react-aria-components directly, so every screen shares one look and one set
// of accessibility behaviour
import "./tokens.css";

export { ActionFooter } from "./ActionFooter.tsx";
export { ActionRow } from "./ActionRow.tsx";
export { Actions } from "./Actions.tsx";
export {
  AppLayout,
  type FootPlace,
  RailButton,
  type NavItem,
} from "./layouts/AppLayout.tsx";
export { Avatar } from "./Avatar.tsx";
export { Breadcrumbs, type Crumb } from "./Breadcrumbs.tsx";
export { Button, buttonStyles, type ButtonProps } from "./Button.tsx";
export { Calendar } from "./Calendar.tsx";
export { CalendarPage } from "./layouts/CalendarPage.tsx";
export { Card } from "./Card.tsx";
export { EmptyState } from "./EmptyState.tsx";
export { Checkbox } from "./Checkbox.tsx";
export {
  CrewFace,
  CrewSection,
  ExtrasSection,
  OpenMark,
  type CrewMember,
} from "./Crew.tsx";
export { DateTile } from "./DateTile.tsx";
export { Chip, ChipGroup } from "./ChipGroup.tsx";
export { ChoiceTile, ChoiceTiles, ChoiceTilesLoading } from "./ChoiceTiles.tsx";
export { DatePicker, TimeField } from "./DateField.tsx";
export { Dialog, DialogTrigger, type DialogState } from "./Dialog.tsx";
export { Drawer } from "./Drawer.tsx";
export { Fact, Facts } from "./Facts.tsx";
export { FieldRow } from "./Field.tsx";
export { Fold } from "./Fold.tsx";
export { EmbeddedField } from "./EmbeddedField.tsx";
export { Form } from "./Form.tsx";
export { Heading } from "./Heading.tsx";
export { IconTile } from "./IconTile.tsx";
export { ButtonLink, ExternalButtonLink, Link, linkStyles } from "./Link.tsx";
export { Logo } from "./Logo.tsx";
export { MessagePage, SignInPage } from "./layouts/MessagePage.tsx";
export {
  LIST_PAGE,
  ListPage,
  DatedItem,
  byMonth,
  type ListColumn,
  type ListRow,
  type ListSearch,
  type ListTab,
} from "./layouts/ListPage.tsx";
export { PageHeader } from "./layouts/PageHeader.tsx";
export {
  ActionButton,
  type PageAction,
  type PageActions,
} from "./layouts/PageActions.tsx";
export { type Alert } from "./layouts/Alerts.tsx";
export { FormPage, FormPart } from "./layouts/FormPage.tsx";
export { PageFrame } from "./layouts/PageFrame.tsx";
export {
  AnswerCard,
  HomePage,
  HomeTiles,
  type HomeTile,
} from "./layouts/HomePage.tsx";
export { DetailsCard, RecordPage } from "./layouts/RecordPage.tsx";
export {
  SettingsList,
  SettingsPage,
  type SettingsPart,
} from "./layouts/SettingsPage.tsx";
export { Menu, MenuItem, MenuSeparator } from "./Menu.tsx";
export { useLanguage, useUiWords } from "./language.ts";
export { LanguageName, LanguagePicker } from "./LanguagePicker.tsx";
export { LanguageProvider } from "./LanguageProvider.tsx";
export { List, ListItem } from "./List.tsx";
export { Notice } from "./Notice.tsx";
export { NumberField } from "./NumberField.tsx";
export { Radio, RadioCard, RadioGroup } from "./RadioGroup.tsx";
export { Section } from "./Section.tsx";
export { Segment, SegmentedControl } from "./SegmentedControl.tsx";
export { Select, SelectItem } from "./Select.tsx";
export { StatusBadge, type StatusTone } from "./StatusBadge.tsx";
export { readStored, store } from "./stored.ts";
export { useSettled } from "./settled.ts";
export { staleFade } from "./stale.ts";
export { Cell, Column, Row, Table, TableBody, TableHeader } from "./Table.tsx";
export { Tab, TabList, TabPanel, Tabs } from "./Tabs.tsx";
export { TestSiteBanner } from "./TestSiteBanner.tsx";
export { Timeline, TimelineItem } from "./Timeline.tsx";
export { TextField } from "./TextField.tsx";
export { isWide, useWide } from "./wide.ts";
export {
  ThemeToggle,
  applyThemePreference,
  readThemePreference,
  type ThemePreference,
} from "./theme.tsx";
export { themeBootScript } from "./theme-boot.ts";
export { ToastRegion, showToast, type ToastContent } from "./Toast.tsx";
export { startTour, type TourStep } from "./Tour.ts";

// wiring for the app's router: design-system links navigate through it, and
// apps declare their link type by augmenting RouterConfig on this module
export { RouterProvider, type RouterConfig } from "react-aria-components";
