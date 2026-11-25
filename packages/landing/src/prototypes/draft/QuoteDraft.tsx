import type { Language } from "@empire-cleaning/models";
import {
  Button,
  buttonStyles,
  Checkbox,
  Chip,
  ChipGroup,
  FieldRow,
  Form,
  Heading,
  Notice,
  NumberField,
  Segment,
  SegmentedControl,
  TextField,
} from "@empire-cleaning/ui";
import {
  Building2,
  CircleCheck,
  House,
  Building,
  Home,
  PaintRoller,
  Phone,
  Plus,
  Sparkles,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { draft } from "./words.ts";

// the Quote form, drawn still for the public site prototype (#505): each
// case is one moment of a stranger's ask, with nothing preset they haven't
// said. "tiles" and "rows" are two ways to show what each service is, at
// its choice
export type Moment =
  | "pick"
  | "picked"
  | "where"
  | "zip"
  | "home"
  | "details"
  | "failed"
  | "nolist"
  | "sent";

const serviceIcons: LucideIcon[] = [
  Sparkles,
  House,
  Truck,
  Building2,
  PaintRoller,
];

const stepOf: Record<Moment, number> = {
  pick: 0,
  picked: 0,
  nolist: 0,
  where: 1,
  zip: 1,
  home: 2,
  details: 3,
  failed: 3,
  sent: 3,
};

type Props = {
  layout: "tiles" | "rows";
  moment: Moment;
  lang: Language;
  phone: { href: string; display: string };
  submit: string;
  callTo: string;
};

// a still radio: what's picked shows it, nothing does anything
function Choice({
  layout,
  icon: Icon,
  name,
  text,
  picked,
}: {
  layout: Props["layout"];
  icon: LucideIcon;
  name: string;
  text?: string;
  picked: boolean;
}) {
  const state = picked
    ? "bg-success-subtle text-success-strong ring-2 ring-primary"
    : "bg-surface-sunken text-fg";
  if (layout === "rows")
    return (
      <label
        className={`flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 ${state}`}
      >
        <input type="radio" className="sr-only" checked={picked} readOnly />
        <Icon aria-hidden size={28} strokeWidth={1.75} className="shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{name}</span>
          {text && <span className="text-sm text-fg-muted">{text}</span>}
        </span>
        {picked && (
          <CircleCheck
            aria-hidden
            size={22}
            className="shrink-0 text-primary"
          />
        )}
      </label>
    );
  return (
    <label
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg px-3 py-4 text-center ${state}`}
    >
      <input type="radio" className="sr-only" checked={picked} readOnly />
      <Icon aria-hidden size={28} strokeWidth={1.75} />
      <span className="text-sm font-semibold">{name}</span>
      {text && (
        <span className="text-xs leading-snug text-fg-muted">{text}</span>
      )}
    </label>
  );
}

// a step's choices: tiles two to a row on a phone, three from a tablet; rows
// one under another
function Choices({
  layout,
  count,
  children,
}: {
  layout: Props["layout"];
  count: number;
  children: ReactNode;
}) {
  // as ChoiceTiles: a short last row's tiles grow to fill it
  const grid =
    layout === "rows"
      ? "flex flex-col gap-2"
      : `flex flex-wrap gap-2 [&>*]:grow ${
          count === 4
            ? "[&>*]:basis-[calc((100%_-_0.5rem)/2)] sm:[&>*]:basis-[calc((100%_-_1.5rem)/4)]"
            : "[&>*]:basis-[calc((100%_-_0.5rem)/2)] sm:[&>*]:basis-[calc((100%_-_1rem)/3)]"
        }`;
  return <div className={`max-w-form ${grid}`}>{children}</div>;
}

export function QuoteDraft({
  layout,
  moment,
  lang,
  phone,
  submit,
  callTo,
}: Props) {
  const t = draft[lang].quote;
  const filled = draft[lang].filled;
  const services = draft[lang].services;
  const at = stepOf[moment];
  const titles = [t.service, t.where, t.apartmentTitle, t.details];

  if (moment === "sent")
    return (
      <Notice tone="success">
        <strong>{t.sent}</strong>
        <span>{t.sentTo}</span>
      </Notice>
    );

  const kinds: [LucideIcon, string][] = [
    [Home, t.house],
    [Building, t.apartment],
    [House, t.townhouse],
    [Store, t.business],
  ];

  const fields: ReactNode[] = [
    // what they need: each service with what it is, at its choice
    moment === "nolist" ? null : (
      <div key="service" className="flex flex-col gap-2">
        <Choices layout={layout} count={services.length}>
          {services.map(({ name, text }, i) => (
            <Choice
              key={name}
              layout={layout}
              icon={serviceIcons[i]!}
              name={name}
              text={text}
              picked={moment === "picked" && i === 1}
            />
          ))}
        </Choices>
        <p className="text-sm text-fg-muted">{t.serviceHelp}</p>
      </div>
    ),
    // where: what kind of place, then its address
    <Fragment key="where">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t.what}</span>
        <Choices layout="tiles" count={4}>
          {kinds.map(([icon, name], i) => (
            <Choice
              key={name}
              layout="tiles"
              icon={icon}
              name={name}
              picked={moment === "zip" && i === 1}
            />
          ))}
        </Choices>
      </div>
      <TextField
        label={t.street}
        value={moment === "zip" ? filled.street : ""}
        isRequired
      />
      <FieldRow>
        <TextField label={t.unit} value={moment === "zip" ? filled.unit : ""} />
        <TextField
          label={t.zip}
          value={moment === "zip" ? filled.badZip : ""}
          isRequired
          isInvalid={moment === "zip"}
          errorMessage={moment === "zip" ? t.zipRefused : undefined}
        />
      </FieldRow>
    </Fragment>,
    // the apartment: no floors to ask
    <Fragment key="home">
      <SegmentedControl
        label={t.condition}
        value={t.conditions[1]}
        description={t.conditionNote}
        isRequired
      >
        {t.conditions.map((c) => (
          <Segment key={c} value={c}>
            {c}
          </Segment>
        ))}
      </SegmentedControl>
      <FieldRow>
        <NumberField label={t.bedrooms} description={t.studio} value={1} />
        <NumberField
          label={t.bathrooms}
          description={t.halfBaths}
          value={1}
          step={0.5}
        />
      </FieldRow>
      <ChipGroup label={t.extras} description={t.extrasNote} value={[]}>
        {t.addOns.map((name) => (
          <Chip key={name} value={name}>
            {name}
          </Chip>
        ))}
      </ChipGroup>
      <div className="flex flex-col gap-1">
        <Checkbox isSelected={false}>{t.pets}</Checkbox>
        <Checkbox isSelected={false}>{t.regular}</Checkbox>
      </div>
      <Button variant="text" className="-ms-4 self-start" size="md">
        <Plus aria-hidden size={18} />
        {t.addNote}
      </Button>
    </Fragment>,
    // how to reach them
    <Fragment key="details">
      <TextField label={t.fullName} value={filled.name} isRequired />
      <TextField
        label={t.email}
        description={t.emailNote}
        value={filled.email}
        type="email"
        isRequired
      />
      <TextField
        label={t.phone}
        description={t.phoneNote}
        value={filled.phone}
        type="tel"
        isRequired
      />
    </Fragment>,
  ];

  const isLast = at === titles.length - 1;
  return (
    <Form>
      <div className="flex flex-col gap-3">
        {/* where they are, as a picture; the count for a screen reader */}
        <div className="flex gap-1" aria-hidden>
          {titles.map((title, i) => (
            <span
              key={title}
              className={`h-1 flex-1 rounded-full ${i <= at ? "bg-primary" : "bg-surface-sunken"}`}
            />
          ))}
        </div>
        <p className="sr-only">{t.step(at + 1, titles.length)}</p>
        <Heading level={3} size={3}>
          {titles[at]}
        </Heading>
      </div>

      {moment === "nolist" && <Notice tone="danger">{t.servicesFailed}</Notice>}

      {fields[at]}

      {moment === "failed" && <Notice tone="danger">{t.failed}</Notice>}

      {/* Back small beside the step's action, which leads on the right */}
      <div className="flex items-center gap-3 pt-2 sm:justify-end">
        {moment === "nolist" ? (
          <>
            <Button variant="secondary">{t.tryAgain}</Button>
            <a
              href={phone.href}
              className={buttonStyles({ className: "flex-1 sm:flex-none" })}
            >
              <Phone aria-hidden size={18} />
              {callTo}
            </a>
          </>
        ) : (
          <>
            {at > 0 && <Button variant="secondary">{t.back}</Button>}
            <Button className="flex-1 sm:flex-none">
              {isLast ? submit : t.next}
            </Button>
          </>
        )}
      </div>
    </Form>
  );
}
