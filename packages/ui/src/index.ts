// the design system (@empire-cleaning/ui): import components from here, never from
// react-aria-components directly, so every screen shares one look and one set
// of accessibility behaviour
import "./tokens.css";

export { Actions } from "./Actions.tsx";
export { AppLayout, Wordmark, type NavItem } from "./AppLayout.tsx";
export { Breadcrumbs, type Crumb } from "./Breadcrumbs.tsx";
export { Button, buttonStyles, type ButtonProps } from "./Button.tsx";
export { Calendar } from "./Calendar.tsx";
export { Card } from "./Card.tsx";
export { Checkbox } from "./Checkbox.tsx";
export { DatePicker, TimeField } from "./DateField.tsx";
export { Dialog, DialogTrigger } from "./Dialog.tsx";
export { Form } from "./Form.tsx";
export { Heading } from "./Heading.tsx";
export { ButtonLink, Link } from "./Link.tsx";
export { List, ListItem } from "./List.tsx";
export { Notice } from "./Notice.tsx";
export { NumberField } from "./NumberField.tsx";
export { Radio, RadioGroup } from "./RadioGroup.tsx";
export { Select, SelectItem } from "./Select.tsx";
export { StatusBadge, type StatusTone } from "./StatusBadge.tsx";
export { Cell, Column, Row, Table, TableBody, TableHeader } from "./Table.tsx";
export { TextField } from "./TextField.tsx";
export {
  ThemeToggle,
  applyThemePreference,
  readThemePreference,
  type ThemePreference,
} from "./theme.tsx";
export { themeBootScript } from "./theme-boot.ts";
export { ToastRegion, showToast, type ToastContent } from "./Toast.tsx";

// wiring for the app's router: design-system links navigate through it, and
// apps declare their link type by augmenting RouterConfig on this module
export { RouterProvider, type RouterConfig } from "react-aria-components";
