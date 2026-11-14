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
import { ActionFooter, type Footer } from "../ActionFooter.tsx";
import { Actions } from "../Actions.tsx";
import type { Crumb } from "../Breadcrumbs.tsx";
import { Card } from "../Card.tsx";
import { Fold } from "../Fold.tsx";
import { Section } from "../Section.tsx";
import { Alerts, type Alert } from "./Alerts.tsx";
import { Beside } from "./Beside.tsx";
import { PageFrame } from "./PageFrame.tsx";
import { PageHeader, type PageActions } from "./PageHeader.tsx";

// The Form page type's layout (docs/ux.md, Screen types, Form page; #434): a
// form with a page of its own. Its PageHeader, a single page action at the
// end of the title row; its alerts; what the page needs explained, folded
// (`about`); then the whole form in one Card, its parts open where they're
// what the person came for and folded to a line where they aren't
// (FormPart), the card ending with what's said before its buttons and the
// buttons; or, for a form with a price or a Send, those in the page's
// `footer`, an ActionFooter, what's said before them after the card. What
// the fields come to (a price, a worked example) is an aside, sticky beside
// the card from `xl`; below that after the card, or before it when it
// `leads` (a price the form is written to reach). Outside an area it's a
// page of its own, the logo above (Welcome)
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
  footer,
  account,
  children,
}: {
  trail?: Crumb[];
  title: string;
  status?: ReactNode;
  subtitle?: ReactNode;
  // a single one, at the end of the title row (Retire, Delete draft)
  actions?: PageActions;
  // those that apply now, the rest false, null or undefined
  alerts?: (Alert | false | null | undefined)[];
  // what the page needs explained, folded under `label`
  about?: { label: string; children: ReactNode };
  // what the fields come to, beside them from xl
  aside?: { title: string; leads?: boolean; children: ReactNode };
  // what's said before the buttons: a card's consent, a save's problem
  end?: ReactNode;
  // outside an area: who's signed in, beside the logo
  account?: ReactNode;
  // its parts, each a FormPart, or a stepped form of its own
  children: ReactNode;
} & (
  | {
      // the form's buttons at the card's foot, the main one last
      buttons?: ReactNode;
      footer?: never;
    }
  | { buttons?: never; footer: Footer }
)) {
  const card = (
    <Card>
      <div className="flex flex-col gap-5">{children}</div>
      {!footer && (end || buttons) && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {end}
          {buttons && <Actions>{buttons}</Actions>}
        </div>
      )}
    </Card>
  );
  return (
    <PageFrame wide account={account}>
      <PageHeader
        trail={trail}
        title={title}
        status={status}
        subtitle={subtitle}
        actions={actions}
      />
      <Alerts alerts={alerts} />
      {about && (
        <div className="-mt-2">
          <Fold label={about.label}>{about.children}</Fold>
        </div>
      )}
      <Beside
        sticky
        leads={aside?.leads}
        side={
          aside && (
            <Section title={aside.title}>
              <Card>{aside.children}</Card>
            </Section>
          )
        }
      >
        {footer && end ? (
          <div className="flex flex-col gap-4">
            {card}
            {end}
          </div>
        ) : (
          card
        )}
      </Beside>
      {footer && (
        <ActionFooter
          aria-label={footer.label}
          summary={footer.summary}
          status={footer.status}
        >
          {footer.children}
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
