import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FormValidationContext } from "react-aria-components";
import { ChevronDown } from "lucide-react";
import { ActionFooter } from "../ActionFooter.tsx";
import { Actions } from "../Actions.tsx";
import type { Crumb } from "../Breadcrumbs.tsx";
import { Card } from "../Card.tsx";
import { Fold } from "../Fold.tsx";
import { useUiWords } from "../language.ts";
import { Section } from "../Section.tsx";
import { useWide } from "../wide.ts";
import { Alerts, type Alert } from "./Alerts.tsx";
import { PageFrame } from "./PageFrame.tsx";
import {
  ActionButton,
  type NextAction,
  type PageActions,
} from "./PageActions.tsx";
import { PageHeader } from "./PageHeader.tsx";

// what the fields come to, beside them from xl
type Aside = { title: string; leads?: boolean; children: ReactNode };

// a priced form's price: in a line (`line`, at a phone's foot) and in the
// fewest words (`short`, in the header that sticks); or, until it can be
// worked out, what's missing, said in its place
type FormPrice = { line: string; short: string } | { missing: string };

// The Form page type's layout (docs/ux.md, Screen types, Form page; #434): a
// form with a page of its own. Its PageHeader, a single page action at the
// end of the title row; its alerts; what the page needs explained, folded
// (`about`); then the whole form in one Card, its parts open where they're
// what the person came for and folded to a line where they aren't
// (FormPart), the card ending with what's said before its buttons and the
// buttons. A form with a price or a Send (the Draft, New quote) has its
// button as the page's `next` instead, what's said before it after the
// card: from md the header's primary, the rest behind its arrow, its
// `note` (whether it's saved) beside it, and the header that sticks
// carrying the price too while the aside isn't beside the form; on a phone
// an ActionFooter with the price in a line, the note and the button, the
// rest on the title row (#493 D1: a bar at the foot is a phone's). What
// the fields come to (a price, a worked example) is an aside, sticky beside
// the card from `xl`; below that after the card, or before it when it
// `leads` (a price the form is written to reach). With no aside, the page
// is a form's width, its header with it (docs/ux.md, Forms). Outside an
// area it's a page of its own, the logo above (Welcome)
export function FormPage({
  trail,
  title,
  status,
  subtitle,
  actions,
  alerts = [],
  about,
  aside,
  end,
  buttons,
  next,
  price,
  note,
  account,
  children,
}: {
  trail?: Crumb[];
  title: string;
  status?: ReactNode;
  subtitle?: ReactNode;
  // a single one, at the end of the title row (Retire); with a `next`,
  // the rest behind its arrow (Delete draft)
  actions?: PageActions;
  // those that apply now, the rest false, null or undefined
  alerts?: (Alert | false | null | undefined)[];
  // what the page needs explained, folded under `label`
  about?: { label: string; children: ReactNode };
  // what's said before the buttons: a card's consent, a save's problem
  end?: ReactNode;
  // outside an area: who's signed in, under the logo on a phone and beside
  // it from sm
  account?: ReactNode;
  // its parts, each a FormPart, or a stepped form of its own
  children: ReactNode;
} & (
  | {
      // the form's buttons at the card's foot, the main one last
      buttons?: ReactNode;
      next?: never;
      price?: never;
      note?: never;
      // what the fields come to, beside them from xl
      aside?: Aside;
    }
  // a form with a price or a Send: its button the page's next step, its
  // price in the aside, which the page is wide enough to hold
  | {
      buttons?: never;
      next: NextAction;
      price?: FormPrice;
      // whether it's saved, read out as it changes
      note?: string;
      aside: Aside;
    }
)) {
  const words = useUiWords();
  const wide = useWide();
  const missing = price && "missing" in price ? price.missing : undefined;
  const card = (
    <Card>
      <div className="flex flex-col gap-5">{children}</div>
      {!next && (end || buttons) && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {end}
          {buttons && <Actions>{buttons}</Actions>}
        </div>
      )}
    </Card>
  );
  const form =
    next && end ? (
      <div className="flex flex-col gap-4">
        {card}
        {end}
      </div>
    ) : (
      card
    );
  const side = aside && (
    <div
      // under the header that sticks, when the page has one
      className={`xl:sticky xl:top-[calc(var(--sticky-header-height,0px)+1.5rem)] ${aside.leads ? "xl:col-start-2 xl:row-start-1" : ""}`}
    >
      <Section title={aside.title}>
        <Card>{aside.children}</Card>
      </Section>
    </div>
  );
  return (
    <PageFrame width={aside ? "wide" : "form"} account={account}>
      {/* the next step the header's from md; on a phone the foot's, the
          rest left on the title row */}
      <PageHeader
        trail={trail}
        title={title}
        status={status}
        subtitle={subtitle}
        actions={actions}
        next={wide ? next : undefined}
        note={
          wide &&
          (note ??
            // read out from here as it changes; the aside shows it
            (missing && <span className="sr-only">{missing}</span>))
        }
        summary={
          wide &&
          price && (
            // the aside's, said again only while it isn't beside the form
            <span className="xl:hidden">
              {"short" in price ? (
                <span className="font-semibold tabular-nums">
                  {price.short}
                </span>
              ) : (
                <span className="text-sm text-fg-muted">{price.missing}</span>
              )}
            </span>
          )
        }
      />
      <Alerts alerts={alerts} />
      {about && (
        <div className="-mt-2">
          <Fold label={about.label}>{about.children}</Fold>
        </div>
      )}
      {/* the form, and what it comes to beside it in a 22rem column from
          xl, sticky as the form scrolls past; below xl after the form, or
          first when it leads: first in the page too, so a phone reads and
          tabs through it in the order it's seen. With nothing beside it,
          one column, a form's width, lined up with the header */}
      <div
        className={`grid grid-cols-[minmax(0,1fr)] items-start gap-6 ${side ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}
      >
        {aside?.leads && side}
        {aside?.leads ? (
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">{form}</div>
        ) : (
          form
        )}
        {!aside?.leads && side}
      </div>
      {next && (
        <ActionFooter
          aria-label={words.whatToDo}
          summary={price && "line" in price ? price.line : undefined}
          status={note ?? missing}
          phone
        >
          <ActionButton action={next} variant="primary" />
        </ActionFooter>
      )}
    </PageFrame>
  );
}

const rule = "border-t border-border pt-5 first:border-t-0 first:pt-0";

// One part of a Form page's card, ruled off from the one before. Open, a
// Section: its title over its fields, its text Buttons (`actions`) on the
// title's line. Given `summary` (what's set, in a line), it's folded to that line, a tap
// opening it in place. Folded, its fields stay in the form, hidden, so a
// required one or the API's field error still counts, and the part opens
// itself to show a field in it that's found wrong
export function FormPart(
  props: { title: string; children: ReactNode } & (
    { summary: string } | { summary?: never; actions?: ReactNode }
  ),
) {
  const { title, children } = props;
  if (props.summary === undefined)
    return (
      <Section
        title={title}
        actions={props.actions}
        className={`gap-4 ${rule}`}
      >
        {children}
      </Section>
    );
  return (
    <Folded title={title} summary={props.summary}>
      {children}
    </Folded>
  );
}

function Folded({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const bodyId = useId();
  const body = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // the API's field errors, given to the form after it's sent: once its
  // fields have them, one in here marked invalid opens it
  const errors = useContext(FormValidationContext);
  useEffect(() => {
    if (body.current?.querySelector("[data-invalid]")) setOpen(true);
  }, [errors]);
  return (
    <section
      aria-label={title}
      className={`flex flex-col gap-4 ${rule}`}
      // a field the browser finds wrong as the form's sent (a required one
      // left empty) opens it, so it can be shown
      onInvalidCapture={() => setOpen(true)}
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-1 text-left outline-offset-2 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <span className="font-semibold text-fg sm:w-40 sm:shrink-0">
              {title}
            </span>
            {!open && (
              <span className="text-fg-muted [overflow-wrap:anywhere]">
                {summary}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            size={20}
            className={`shrink-0 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      <div
        ref={body}
        id={bodyId}
        hidden={!open}
        className="flex flex-col gap-4"
      >
        {children}
      </div>
    </section>
  );
}
