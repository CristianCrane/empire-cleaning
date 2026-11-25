// PROTOTYPE: throwaway. An off-session charge on a Client's saved card that
// their bank wants them to approve (Stripe's authentication_required, 3-D
// Secure): the Client comes back and approves that same payment with the
// card they saved, their bank's check in a pop-up, as CardForm's
// handleNextAction does (#534). Made-up data, at
// /prototype/approve-payment?layout=A..C&case=1..14 (no sign-in), in the
// app's real frames. ↑/↓ switch layouts, ←/→ cases. Pressing Approve walks
// to the bank's check, and its buttons to approved or refused.
//   A  Approve is the next step: an alert says why, "Approve payment" is the
//      page's primary, "Use another card" behind its arrow; badge "Needs
//      approval" (warning)
//   B  a payment part leads: the amount, the card and "Approve payment" in
//      a part of their own above the details, no alert and no header
//      primary; a refusal says so in that part
//   C  one Pay, saved card first: today's Unpaid, with "Pay $142.50" the
//      primary, its dialog the saved card picked ("Your bank will ask you
//      to approve it") or another card; a refusal stays in the dialog
// The Office's screens are the same in A to C, but for the phone
// acceptance (case 14): A a Notice in the dialog, B the dialog closes and
// the page says it, C A's Notice with "Email Ada her quote again".
// Lives only on prototype-approve-payment.
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Ban,
  Banknote,
  CalendarDays,
  CalendarRange,
  CalendarSync,
  CircleCheck,
  CreditCard,
  FileText,
  History,
  Mail,
  MapPin,
  Printer,
  ReceiptText,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { formats, oneStop } from "@empire-cleaning/models";
import {
  Actions,
  AppLayout,
  Button,
  ButtonLink,
  Card,
  DateTile,
  DetailsCard,
  Dialog,
  Fact,
  Facts,
  Figure,
  Figures,
  HomePage,
  IconTile,
  LanguageProvider,
  Link,
  type Alert,
  type NavItem,
  Notice,
  type PageAction,
  Radio,
  RadioGroup,
  RecordPage,
  Section,
  showToast,
  StatusBadge,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { navFor } from "../AreaLayout.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { HeroCard, whyAlert } from "./HeroCard.tsx";

type Lang = "en" | "es";
type Layout = "A" | "B" | "C";
type Moment = "before" | "check" | "refused" | "approved";

const say = (what: string) => () =>
  showToast({ title: `Prototype: "${what}" does nothing here`, tone: "info" });

// the made-up Client, clean and Bill
const ADA = {
  name: "Ada Okafor",
  first: "Ada",
  email: "ada.okafor@example.com",
};
const HOME = "41-12 Austin St, Apt 4B, Forest Hills, NY 11375";
const CARD = { en: "Visa ending 4242", es: "Visa terminada en 4242" };
const CLEAN_AT = "2026-11-25T14:00:00Z"; // Tue, Nov 25, 9:00 AM in New York
const DONE_AT = "2026-11-25T17:10:00Z";
const DEPOSIT_AT = "2026-11-18T15:00:00Z";
const BILL = {
  number: "EC-000123",
  weekStart: "2026-11-17",
  weekEnd: "2026-11-23",
  madeAt: "2026-11-24T11:00:00Z",
  lines: [
    { label: "Standard Clean, Tue, Nov 18", cents: 10620 },
    { label: "Standard Clean, Thu, Nov 20", cents: 10620 },
  ],
  taxCents: 1731,
  totalCents: 21240,
};

// the bank stand-in's own words, as a bank might say them
const BANK = {
  en: {
    name: "Your bank",
    kicker: "YOUR BANK",
    title: "Confirm your purchase",
    merchant: "Merchant",
    amount: "Amount",
    card: "Card",
    line: "Approve this purchase in your banking app.",
    cancel: "Cancel",
    ok: "I've approved it",
  },
  es: {
    name: "Su banco",
    kicker: "SU BANCO",
    title: "Confirme su compra",
    merchant: "Comercio",
    amount: "Importe",
    card: "Tarjeta",
    line: "Apruebe esta compra en la app de su banco.",
    cancel: "Cancelar",
    ok: "Ya lo aprobé",
  },
} satisfies Record<Lang, Record<string, string>>;

const W = {
  en: {
    approve: "Approve payment",
    useAnother: "Use another card",
    payAnother: "Pay another way",
    needsApproval: "Needs approval",
    unpaid: "Unpaid",
    done: "Done",
    paidBadge: "Paid",
    bankWants: "Your bank wants you to approve this payment.",
    nothingYet: (card: string) =>
      `Nothing has been taken from your ${card} yet.`,
    nothingTaken: "Nothing has been taken yet.",
    paused: "Until it's paid, we won't book more cleans on your plan.",
    refusedTitle: "The payment wasn't approved.",
    refusedLine: "Nothing was taken. You can try again.",
    paidClean: "Thank you, your clean is paid",
    paidBill: "Thank you, your bill is paid",
    pay: (amount: string) => `Pay ${amount}`,
    payThis: "Pay this bill",
    yourPayment: "Your payment",
    toApprove: "To approve",
    howYouPay: "How you pay",
    fromCard: (card: string) => `From your ${card}`,
    bankWillAsk: "Your bank will ask you to approve it.",
    another: "Another card",
    anotherLine: "You'll add it on the next page.",
    anotherOrBank: "Another card or bank account",
    cancel: "Cancel",
    receipt: "Your receipt",
    doneAt: (when: string) => oneStop(`Done ${when}.`),
    service: "Standard Clean",
    pricesTax: "Prices include tax.",
    total: "Total",
    deposit: "Deposit",
    rest: "The rest",
    paid: "Paid",
    details: "Clean details",
    oneOff: "One-off clean",
    partOfPlan: "Part of your cleaning plan",
    cleaningPlan: "Cleaning plan",
    seeYourPlan: "See your plan",
    heldThere: "Its deposit is held there",
    cleans: "Cleans",
    paymentNeeded: "Payment needed.",
    couldntTake: (amount: string) =>
      `We couldn't take ${amount} from your card.`,
    addCardFix: "Please add a card and we'll try again straight away.",
    addCard: "Add a card",
    forClean: "For this clean",
    payments: "Payments",
  },
  es: {
    approve: "Aprobar el pago",
    useAnother: "Usar otra tarjeta",
    payAnother: "Pagar de otra forma",
    needsApproval: "Por aprobar",
    unpaid: "Sin pagar",
    done: "Terminada",
    paidBadge: "Pagada",
    bankWants: "Su banco quiere que apruebe este pago.",
    nothingYet: (card: string) => `Aún no se ha cobrado nada de su ${card}.`,
    nothingTaken: "Aún no se ha cobrado nada.",
    paused: "Hasta que se pague, no reservaremos más limpiezas de su plan.",
    refusedTitle: "El pago no se aprobó.",
    refusedLine: "No se cobró nada. Puede intentarlo de nuevo.",
    paidClean: "Gracias, su limpieza está pagada",
    paidBill: "Gracias, su factura está pagada",
    pay: (amount: string) => `Pagar ${amount}`,
    payThis: "Pagar esta factura",
    yourPayment: "Su pago",
    toApprove: "Por aprobar",
    howYouPay: "Cómo paga",
    fromCard: (card: string) => `De su ${card}`,
    bankWillAsk: "Su banco le pedirá que lo apruebe.",
    another: "Otra tarjeta",
    anotherLine: "La agregará en la página siguiente.",
    anotherOrBank: "Otra tarjeta o cuenta bancaria",
    cancel: "Cancelar",
    receipt: "Su recibo",
    doneAt: (when: string) => oneStop(`Terminada el ${when}.`),
    service: "Limpieza estándar",
    pricesTax: "Los precios incluyen impuestos.",
    total: "Total",
    deposit: "Depósito",
    rest: "El resto",
    paid: "Pagado",
    details: "Detalles de la limpieza",
    oneOff: "Una sola limpieza",
    partOfPlan: "Parte de su plan de limpieza",
    cleaningPlan: "Plan de limpieza",
    seeYourPlan: "Ver su plan",
    heldThere: "Su depósito está retenido allí",
    cleans: "Limpiezas",
    paymentNeeded: "Hay un pago pendiente.",
    couldntTake: (amount: string) =>
      `No pudimos cobrar ${amount} de su tarjeta.`,
    addCardFix: "Agregue una tarjeta y lo intentaremos de nuevo de inmediato.",
    addCard: "Agregar una tarjeta",
    forClean: "Por esta limpieza",
    payments: "Pagos",
  },
};

const cardPage = linkTo({ to: "/portal/payment-method" });

// a toast once, as the moment's page opens (refused, approved)
function useToastOnce(toast: Parameters<typeof showToast>[0] | null) {
  useEffect(() => {
    // a timeout StrictMode's first unmount cancels, so it shows once
    const id = toast ? setTimeout(() => showToast(toast), 0) : undefined;
    return () => clearTimeout(id);
    // once per case: the page is keyed by it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ---------------------------------------------------------------- frames

function ClientFrame({
  lang,
  current,
  children,
}: {
  lang: Lang;
  current: string;
  children: ReactNode;
}) {
  const nav: NavItem[] = navFor(lang).portal.map(
    ({ alsoCurrentFor: _a, jobSection: _j, countsOffers: _c, ...item }) => ({
      ...item,
      isCurrent: item.label === current,
    }),
  );
  return (
    <LanguageProvider lang={lang}>
      <AppLayout area="Empire Cleaning" nav={nav} foot={() => null}>
        {children}
      </AppLayout>
    </LanguageProvider>
  );
}

function OfficeFrame({
  current,
  children,
}: {
  current: string;
  children: ReactNode;
}) {
  const nav: NavItem[] = navFor("en").office.map(
    ({ alsoCurrentFor: _a, jobSection: _j, countsOffers: _c, ...item }) => ({
      ...item,
      isCurrent: item.label === current,
    }),
  );
  return (
    <AppLayout area="Office" nav={nav} foot={() => null}>
      {children}
    </AppLayout>
  );
}

// The bank's own check, which Stripe draws over our page (handleNextAction):
// not ours to design, so a plain stand-in, labelled as one
function BankCheck({
  amount,
  lang,
  onApprove,
  onCancel,
}: {
  amount: string;
  lang: Lang;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const b = BANK[lang];
  const grey = "#6b7280";
  const row = { display: "contents" } as const;
  return (
    <div
      role="dialog"
      aria-label={b.name}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#fff",
          color: "#111827",
          borderRadius: 6,
          overflow: "hidden",
          fontFamily: "Arial, Helvetica, sans-serif",
          boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
        }}
      >
        <p
          style={{
            margin: 0,
            padding: "8px 16px",
            background: "#e5e7eb",
            color: "#4b5563",
            fontSize: 12,
          }}
        >
          Stand-in for your bank's own screen (drawn by the bank, not us)
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 20,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3,
              color: grey,
            }}
          >
            {b.kicker}
          </p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{b.title}</p>
          <dl
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 16,
              rowGap: 4,
              fontSize: 14,
            }}
          >
            <div style={row}>
              <dt style={{ color: grey }}>{b.merchant}</dt>
              <dd style={{ margin: 0 }}>EMPIRE CLEANING PRO</dd>
            </div>
            <div style={row}>
              <dt style={{ color: grey }}>{b.amount}</dt>
              <dd style={{ margin: 0 }}>{amount}</dd>
            </div>
            <div style={row}>
              <dt style={{ color: grey }}>{b.card}</dt>
              <dd style={{ margin: 0 }}>•••• 4242</dd>
            </div>
          </dl>
          <p style={{ margin: 0, fontSize: 14, color: "#4b5563" }}>{b.line}</p>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              paddingTop: 8,
            }}
          >
            <button
              type="button"
              style={{
                padding: "8px 12px",
                fontSize: 14,
                color: "#374151",
                background: "none",
                border: 0,
              }}
              onClick={onCancel}
            >
              {b.cancel}
            </button>
            <button
              type="button"
              style={{
                padding: "8px 12px",
                fontSize: 14,
                color: "#fff",
                background: "#1f2937",
                border: 0,
                borderRadius: 4,
              }}
              onClick={onApprove}
            >
              {b.ok}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the clean

type Go = (change: { layout?: string; case?: string }) => void;

function CleanPage({
  layout,
  lang,
  moment,
  plan = false,
  noCard = false,
  go,
}: {
  layout: Layout;
  lang: Lang;
  moment: Moment;
  plan?: boolean;
  noCard?: boolean;
  go: Go;
}) {
  const t = W[lang];
  const f = formats[lang];
  const card = CARD[lang];
  const owedCents = plan ? 16566 : 14250;
  const totalCents = plan ? 16566 : 19000;
  const owed = f.formatMoney(owedCents);
  const approved = moment === "approved";
  const [open, setOpen] = useState(
    layout === "C" && (moment === "check" || moment === "refused"),
  );
  const checking = moment === "check";

  useToastOnce(approved ? { title: t.paidClean, tone: "success" } : null);

  const toCheck = () => go({ case: "2" });
  const approve: PageAction = {
    label: t.approve,
    icon: ShieldCheck,
    isPending: checking,
    onAction: toCheck,
  };
  const useAnother: PageAction = {
    label: t.useAnother,
    icon: CreditCard,
    href: cardPage,
  };
  const pay: PageAction = {
    label: t.pay(owed),
    icon: CreditCard,
    onAction: () => setOpen(true),
  };

  const paused = plan ? ` ${t.paused}` : "";
  const alerts: Alert[] = approved
    ? []
    : noCard
      ? [
          {
            key: "unpaid",
            tone: "danger",
            children: (
              <p>
                <strong>{t.paymentNeeded}</strong> {t.couldntTake(owed)}{" "}
                {t.addCardFix}
                {paused}
              </p>
            ),
          },
        ]
      : layout !== "B"
        ? [
            {
              key: "approve",
              tone: "warning",
              action:
                layout === "A" && moment === "refused" ? (
                  <ButtonLink variant="text" href={cardPage}>
                    <CreditCard aria-hidden size={18} />
                    {t.useAnother}
                  </ButtonLink>
                ) : undefined,
              children: (
                <p>
                  {moment === "refused" ? (
                    <>
                      <strong>{t.refusedTitle}</strong> {t.refusedLine}
                    </>
                  ) : (
                    <>
                      <strong>{t.bankWants}</strong> {t.nothingYet(card)}
                    </>
                  )}
                  {paused}
                </p>
              ),
            },
          ]
        : [];

  const status = approved ? (
    <StatusBadge tone="success">{t.done}</StatusBadge>
  ) : noCard ? (
    <StatusBadge tone="danger">{t.unpaid}</StatusBadge>
  ) : (
    <StatusBadge tone="warning">{t.needsApproval}</StatusBadge>
  );

  const next: PageAction | undefined = approved
    ? undefined
    : noCard
      ? { label: t.addCard, icon: CreditCard, href: cardPage }
      : layout === "A"
        ? approve
        : layout === "C"
          ? pay
          : undefined;

  const details = (
    <DetailsCard
      label={t.details}
      tile={<DateTile date={CLEAN_AT} />}
      kicker={plan ? t.partOfPlan : t.oneOff}
      title={f.formatDateTime(CLEAN_AT)}
      line={HOME}
    >
      {plan && (
        <Facts columns={1}>
          <Fact
            icon={CalendarSync}
            label={t.cleaningPlan}
            value={
              <Link href={linkTo({ to: "/portal" })}>{t.seeYourPlan}</Link>
            }
            line={t.heldThere}
          />
        </Facts>
      )}
    </DetailsCard>
  );

  return (
    <ClientFrame lang={lang} current={t.cleans}>
      <RecordPage
        trail={[
          { label: t.cleans, href: linkTo({ to: "/portal/cleans" }) },
          { label: f.formatDateTime(CLEAN_AT) },
        ]}
        title={t.service}
        status={status}
        next={next}
        actions={approved || noCard ? [] : layout === "A" ? [useAnother] : []}
        alerts={alerts}
        details={
          layout === "B" && !approved && !noCard ? (
            <>
              <PayPart
                lang={lang}
                amount={owed}
                plan={plan}
                checking={checking}
                refused={moment === "refused"}
                onApprove={toCheck}
                kicker={t.forClean}
                other={
                  <ButtonLink variant="text" href={cardPage}>
                    <CreditCard aria-hidden size={18} />
                    {t.useAnother}
                  </ButtonLink>
                }
              />
              {details}
            </>
          ) : (
            details
          )
        }
      >
        <Section
          title={t.receipt}
          description={`${t.doneAt(f.formatDateTime(DONE_AT))} ${t.pricesTax}`}
        >
          <Card>
            <Figures size="md">
              <Figure
                label={t.total}
                value={f.formatMoney(totalCents)}
                strong
              />
              {!plan && (
                <Figure
                  label={`${t.deposit} ${f.formatDate(DEPOSIT_AT)}`}
                  value={f.formatMoney(4750)}
                />
              )}
              {approved && (
                <Figure
                  label={`${t.rest} ${f.formatDate(DONE_AT)}`}
                  value={owed}
                />
              )}
              {(approved || !plan) && (
                <Figure
                  label={t.paid}
                  value={f.formatMoney(
                    approved ? totalCents : totalCents - owedCents,
                  )}
                  strong
                />
              )}
              {!approved && (
                <Figure
                  label={noCard ? t.unpaid : t.needsApproval}
                  value={owed}
                  strong
                />
              )}
            </Figures>
          </Card>
        </Section>
      </RecordPage>
      {layout === "C" && !approved && !noCard && (
        <PayDialog
          lang={lang}
          amount={owed}
          isOpen={open}
          onOpenChange={setOpen}
          checking={checking}
          refused={moment === "refused"}
          onPay={toCheck}
          another={t.another}
          anotherLine={t.anotherLine}
        />
      )}
      {checking && (
        <BankCheck
          amount={owed}
          lang={lang}
          onApprove={() => go({ case: "4" })}
          onCancel={() => go({ case: "3" })}
        />
      )}
    </ClientFrame>
  );
}

// B: what's owed, from which card, and Approve, in a part of its own that
// leads the page
function PayPart({
  lang,
  amount,
  plan,
  checking,
  refused,
  onApprove,
  other,
  kicker,
}: {
  kicker: string;
  lang: Lang;
  amount: string;
  plan: boolean;
  checking: boolean;
  refused: boolean;
  onApprove: () => void;
  other: ReactNode;
}) {
  const t = W[lang];
  return (
    <Section title={t.yourPayment}>
      <Card>
        <div className="flex items-center gap-4">
          <IconTile icon={ShieldCheck} tone="warning" size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm text-fg-muted">{kicker}</p>
            <p className="text-xl font-semibold text-fg tabular-nums">
              {amount}
            </p>
            <p className="text-fg-muted">{t.fromCard(CARD[lang])}</p>
          </div>
        </div>
        <p>
          {refused ? (
            <>
              <strong>{t.refusedTitle}</strong> {t.refusedLine}
            </>
          ) : (
            <>
              {t.bankWants} {t.nothingTaken}
            </>
          )}
          {plan && ` ${t.paused}`}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="primary" isPending={checking} onPress={onApprove}>
            <ShieldCheck aria-hidden size={18} />
            {t.approve}
          </Button>
          {other}
        </div>
      </Card>
    </Section>
  );
}

// C: one Pay, the saved card picked first, its bank's check after the press
function PayDialog({
  lang,
  amount,
  isOpen,
  onOpenChange,
  checking,
  refused,
  onPay,
  another,
  anotherLine,
  title,
}: {
  lang: Lang;
  amount: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  checking: boolean;
  refused: boolean;
  onPay: () => void;
  another: string;
  anotherLine?: string;
  title?: string;
}) {
  const t = W[lang];
  const [how, setHow] = useState("saved");
  return (
    <Dialog
      title={title ?? t.pay(amount)}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      {({ close }) => (
        <>
          <RadioGroup label={t.howYouPay} value={how} onChange={setHow}>
            <Radio value="saved" description={t.bankWillAsk}>
              {CARD[lang]}
            </Radio>
            <Radio value="other" description={anotherLine}>
              {another}
            </Radio>
          </RadioGroup>
          {refused && (
            <Notice tone="warning" answers>
              <strong>{t.refusedTitle}</strong> {t.refusedLine}
            </Notice>
          )}
          <Actions>
            <Button variant="quiet" onPress={close}>
              {t.cancel}
            </Button>
            <Button
              variant="primary"
              isPending={checking}
              onPress={how === "saved" ? onPay : say(another)}
            >
              {t.pay(amount)}
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- the Bill

function BillDetails({
  forClient,
  line,
  waiting = false,
}: {
  forClient: boolean;
  line: string;
  waiting?: boolean;
}) {
  const f = formats.en;
  const row = "flex items-start justify-between gap-6";
  return (
    <DetailsCard
      label="Bill details"
      tile={<IconTile icon={FileText} size="lg" />}
      kicker="Total, tax included"
      title={
        <span className="tabular-nums">{f.formatMoney(BILL.totalCents)}</span>
      }
      line={line}
    >
      <Facts columns={3}>
        <Fact
          icon={CalendarRange}
          label="Week"
          value={`${f.formatDay(BILL.weekStart)} to ${f.formatDay(BILL.weekEnd)}`}
          line="The week it covers"
        />
        <Fact
          icon={CalendarDays}
          label="Made"
          value={f.formatDate(BILL.madeAt)}
        />
        <Fact
          icon={CreditCard}
          label="How it's paid"
          value={
            waiting
              ? forClient
                ? "From your card, once you approve it"
                : "From their card, once they approve it"
              : forClient
                ? "From your card, automatically"
                : "From their card, automatically"
          }
        />
      </Facts>
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="font-semibold text-fg">What it's for</p>
        <div className="flex flex-col">
          {BILL.lines.map((l) => (
            <div
              key={l.label}
              className={`${row} border-b border-border py-3 first:pt-0`}
            >
              <Link href={linkTo({ to: "/portal/cleans" })}>{l.label}</Link>
              <span className="tabular-nums">{f.formatMoney(l.cents)}</span>
            </div>
          ))}
          <div className={`${row} pt-3 text-fg-muted`}>
            <span>Tax included</span>
            <span className="tabular-nums">{f.formatMoney(BILL.taxCents)}</span>
          </div>
          <div className={`${row} pt-1 font-semibold`}>
            <span>Total</span>
            <span className="tabular-nums">
              {f.formatMoney(BILL.totalCents)}
            </span>
          </div>
        </div>
      </div>
    </DetailsCard>
  );
}

function BillPage({
  layout,
  moment,
  go,
}: {
  layout: Layout;
  moment: Moment;
  go: Go;
}) {
  const t = W.en;
  const f = formats.en;
  const amount = f.formatMoney(BILL.totalCents);
  const approved = moment === "approved";
  const checking = moment === "check";
  const [open, setOpen] = useState(layout === "C" && checking);
  useToastOnce(approved ? { title: t.paidBill, tone: "success" } : null);

  const toCheck = () => go({ case: "8" });
  const print: PageAction = {
    label: "Print",
    icon: Printer,
    onAction: say("Print"),
  };
  const payAnother: PageAction = {
    label: t.payAnother,
    icon: CreditCard,
    onAction: say(t.payAnother),
  };
  const next: PageAction | undefined = approved
    ? undefined
    : layout === "A"
      ? {
          label: t.approve,
          icon: ShieldCheck,
          isPending: checking,
          onAction: toCheck,
        }
      : layout === "C"
        ? { label: t.payThis, icon: CreditCard, onAction: () => setOpen(true) }
        : undefined;

  const alerts: Alert[] = approved
    ? []
    : layout !== "B"
      ? [
          {
            key: "approve",
            tone: "warning",
            children: (
              <p>
                <strong>{t.bankWants}</strong> {t.nothingYet(CARD.en)}{" "}
                {t.paused}
              </p>
            ),
          },
        ]
      : [];

  const line = approved
    ? `Paid ${f.formatDate("2026-11-25T15:00:00Z")} from your ${CARD.en}`
    : "Not paid yet";

  return (
    <ClientFrame lang="en" current={t.payments}>
      <RecordPage
        trail={[
          { label: t.payments, href: linkTo({ to: "/portal/payments" }) },
          { label: `Bill ${BILL.number}` },
        ]}
        title={`Bill ${BILL.number}`}
        status={
          approved ? (
            <StatusBadge tone="success">{t.paidBadge}</StatusBadge>
          ) : (
            <StatusBadge tone="warning">{t.needsApproval}</StatusBadge>
          )
        }
        next={next}
        actions={
          approved ? [print] : layout === "A" ? [payAnother, print] : [print]
        }
        alerts={alerts}
        details={
          layout === "B" && !approved ? (
            <>
              <PayPart
                lang="en"
                amount={amount}
                plan
                checking={checking}
                refused={false}
                onApprove={toCheck}
                kicker={`For bill ${BILL.number}`}
                other={
                  <Button variant="text" onPress={say(t.payAnother)}>
                    <CreditCard aria-hidden size={18} />
                    {t.payAnother}
                  </Button>
                }
              />
              <BillDetails forClient line={line} waiting={!approved} />
            </>
          ) : (
            <BillDetails forClient line={line} waiting={!approved} />
          )
        }
      />
      {layout === "C" && !approved && (
        <PayDialog
          lang="en"
          title={t.payThis}
          amount={amount}
          isOpen={open}
          onOpenChange={setOpen}
          checking={checking}
          refused={false}
          onPay={toCheck}
          another={t.anotherOrBank}
        />
      )}
      {checking && (
        <BankCheck
          amount={amount}
          lang="en"
          onApprove={() => go({ case: "9" })}
          onCancel={() => go({ case: "7" })}
        />
      )}
    </ClientFrame>
  );
}

// ---------------------------------------------------------------- Payments

function PaymentsPage({ layout }: { layout: Layout }) {
  const t = W.en;
  const f = formats.en;
  const day = f.formatDay("2026-11-25");
  const cleanHref = linkTo({ to: "/portal/cleans" });
  return (
    <ClientFrame lang="en" current={t.payments}>
      <HomePage
        title={t.payments}
        alerts={[
          whyAlert({
            tone: "warning",
            lead: `Your bank wants you to approve your clean's payment. ${t.nothingYet(CARD.en)}`,
          }),
        ]}
        answer={
          <HeroCard
            hero={{
              label: t.toApprove,
              icon: Wallet,
              tone: "warning",
              headline: f.formatMoney(14250),
              lines: [`Your clean on ${day}`],
              action: {
                label: layout === "C" ? t.pay(f.formatMoney(14250)) : t.approve,
                href: cleanHref,
              },
            }}
          />
        }
        tilesLabel="Your payments"
        tiles={[
          {
            id: "all",
            icon: History,
            label: "All payments",
            hint: "4 payments",
            href: linkTo({ to: "/portal/payments" }),
          },
          {
            id: "card",
            icon: CreditCard,
            label: "Your card",
            hint: CARD.en,
            href: cardPage,
          },
        ]}
      />
    </ClientFrame>
  );
}

// ---------------------------------------------------------------- emails

function Email({
  subject,
  children,
  button,
}: {
  subject: string;
  children: ReactNode;
  button: string;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-1 border-b border-border pb-3 text-sm">
        <p>
          <span className="text-fg-muted">From </span>Empire Cleaning Pro
          Services
        </p>
        <p>
          <span className="text-fg-muted">To </span>
          {ADA.email}
        </p>
        <p className="text-base font-semibold text-fg">{subject}</p>
      </div>
      <div className="flex flex-col gap-3">
        {children}
        <div>
          <Button variant="primary" onPress={say(button)}>
            {button}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EmailsPage({ layout }: { layout: Layout }) {
  const t = W.en;
  const f = formats.en;
  const clean = f.formatMoney(14250);
  const bill = f.formatMoney(BILL.totalCents);
  const fee = f.formatMoney(4750);
  const press =
    layout === "C"
      ? "Press Pay below, and your bank will ask you to approve it."
      : "Press the button below, and your bank will ask you to approve it.";
  const button = (amount: string) =>
    layout === "C" ? t.pay(amount) : t.approve;
  return (
    <div className="min-h-dvh bg-surface-sunken px-4 py-6">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <p className="text-sm text-fg-muted">
          The Client's emails, drawn as an inbox shows them
        </p>
        <Email subject="Please approve your payment" button={button(clean)}>
          <p>Hi Ada,</p>
          <p>
            Your bank wants you to approve the {clean} for your clean before
            it's taken from your {CARD.en}. Nothing has been taken yet.
          </p>
          <p className="text-fg-muted">
            Standard Clean · Wednesday, November 25 at 9:00 AM · {HOME}
          </p>
          <p>{press}</p>
        </Email>
        <Email
          subject={`Please approve your payment for bill ${BILL.number}`}
          button={button(bill)}
        >
          <p>Hi Ada,</p>
          <p>
            Your bank wants you to approve the {bill} for bill {BILL.number}{" "}
            before it's taken from your {CARD.en}. Nothing has been taken yet.
          </p>
          <p>{t.paused}</p>
          <p>{press}</p>
        </Email>
        {/* the real skipped email (cancellation/emails.ts): its lines as
            they are, with the fee's line said the new way */}
        <Email
          subject="Your clean is skipped: please approve its fee"
          button={button(fee)}
        >
          <p>Hi Ada,</p>
          <p>We've skipped your clean, as you asked.</p>
          <p className="text-fg-muted">
            Standard Clean · Thursday, November 26 at 9:00 AM · {HOME}
          </p>
          <p>
            Skipping it less than 24 hours before is a late cancellation, with a{" "}
            {fee} fee, that clean's share of your plan's deposit. Your deposit
            stays held.
          </p>
          <p>
            We tried to take the {fee} fee from your {CARD.en}, and your bank
            wants you to approve it first. Nothing has been taken yet. Until
            it's paid, we won't book more cleans on your plan.
          </p>
          <p>{press}</p>
        </Email>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the Office

function OfficeJobPage() {
  const f = formats.en;
  return (
    <OfficeFrame current="Jobs">
      <RecordPage
        trail={[
          { label: "Jobs", href: linkTo({ to: "/office/jobs" }) },
          { label: f.formatDateTime(CLEAN_AT) },
        ]}
        title="Standard Clean"
        status={<StatusBadge tone="warning">Client to approve</StatusBadge>}
        alerts={[
          {
            key: "approve",
            tone: "warning",
            children: (
              <p>
                <strong>
                  Ada's bank wants her to approve the {f.formatMoney(14250)}{" "}
                  payment.
                </strong>{" "}
                None of it was taken. We've emailed her to approve it on her
                clean's page.
              </p>
            ),
          },
        ]}
        details={
          <DetailsCard
            label="Job details"
            tile={<DateTile date={CLEAN_AT} />}
            kicker="One-off clean"
            title={f.formatDateTime(CLEAN_AT)}
            line={HOME}
          >
            <Facts columns={3}>
              <Fact icon={User} label="Client" value={ADA.name} />
              <Fact icon={Users} label="Crew" value="Robin Reyes" />
              <Fact
                icon={ReceiptText}
                label="Price"
                value={f.formatMoney(19000)}
                line="Tax included"
              />
            </Facts>
          </DetailsCard>
        }
      >
        <Section title="Payment">
          <Card>
            <Figures size="md">
              <Figure label="Total" value={f.formatMoney(19000)} strong />
              <Figure
                label={`Deposit ${f.formatDate(DEPOSIT_AT)}`}
                value={f.formatMoney(4750)}
              />
              <Figure label="Paid" value={f.formatMoney(4750)} strong />
              <Figure
                label="Client to approve"
                value={f.formatMoney(14250)}
                strong
              />
            </Figures>
          </Card>
        </Section>
      </RecordPage>
    </OfficeFrame>
  );
}

function OfficeBillPage() {
  return (
    <OfficeFrame current="Clients">
      <RecordPage
        trail={[
          { label: "Clients", href: linkTo({ to: "/office/clients" }) },
          { label: ADA.name, href: linkTo({ to: "/office/clients" }) },
          { label: `Bill ${BILL.number}` },
        ]}
        title={`Bill ${BILL.number}`}
        status={<StatusBadge tone="warning">Client to approve</StatusBadge>}
        next={{
          label: "Record a payment",
          icon: Banknote,
          onAction: say("Record a payment"),
        }}
        actions={[
          { label: "Print", icon: Printer, onAction: say("Print") },
          {
            label: "Cancel bill",
            icon: Ban,
            danger: true,
            onAction: say("Cancel bill"),
          },
        ]}
        alerts={[
          {
            key: "approve",
            tone: "warning",
            children: (
              <p>
                <strong>
                  Ada's bank wants her to approve this bill's payment.
                </strong>{" "}
                Nothing was taken. We've emailed her to approve it on the bill's
                page. Until it's paid, Ada's cleaning plan at 41-12 Austin St is
                paused.
              </p>
            ),
          },
        ]}
        details={<BillDetails forClient={false} line="Not paid yet" waiting />}
      />
    </OfficeFrame>
  );
}

function OfficeQuotePage({ layout }: { layout: Layout }) {
  const f = formats.en;
  const deposit = f.formatMoney(4750);
  const [open, setOpen] = useState(layout !== "B");
  const why = (
    <>
      <strong>
        Ada's bank wants her to approve the {deposit} deposit herself.
      </strong>{" "}
      Nothing was charged or booked. She can accept on her quote's page, and her
      bank will ask her there.
    </>
  );
  return (
    <OfficeFrame current="Quotes">
      <RecordPage
        trail={[
          { label: "Quotes", href: linkTo({ to: "/office/quotes" }) },
          { label: ADA.name, href: linkTo({ to: "/office/clients" }) },
          {
            label: "41-12 Austin St, 4B",
            href: linkTo({ to: "/office/quotes" }),
          },
          { label: "Quote" },
        ]}
        title={`Quote for ${ADA.name}`}
        status={<StatusBadge tone="info">Sent</StatusBadge>}
        next={{
          label: "Record acceptance",
          icon: CircleCheck,
          isDisabled: !open,
          why: "Ada approves it on her quote's page",
          onAction: () => setOpen(true),
        }}
        alerts={
          open
            ? []
            : [{ key: "approve", tone: "warning", children: <p>{why}</p> }]
        }
        details={
          <DetailsCard
            label="Quote details"
            tile={<DateTile date="2026-12-02T14:00:00Z" />}
            kicker="Standard Clean"
            title={f.formatDateTime("2026-12-02T14:00:00Z")}
            line={HOME}
          >
            <Facts columns={3}>
              <Fact
                icon={ReceiptText}
                label="Price"
                value={f.formatMoney(19000)}
                line="Tax included"
              />
              <Fact
                icon={CreditCard}
                label="Deposit"
                value={deposit}
                line={`Their ${CARD.en}`}
              />
              <Fact icon={MapPin} label="Where" value="Forest Hills" />
            </Facts>
          </DetailsCard>
        }
      />
      {layout !== "B" && (
        <Dialog
          title="Record acceptance"
          role="alertdialog"
          isOpen={open}
          onOpenChange={setOpen}
        >
          {({ close }) => (
            <>
              <Notice tone="warning" answers>
                {why}
              </Notice>
              <Actions>
                {layout === "C" ? (
                  <>
                    <Button variant="quiet" onPress={close}>
                      Close
                    </Button>
                    <Button
                      variant="primary"
                      onPress={say("Email Ada her quote again")}
                    >
                      <Mail aria-hidden size={18} />
                      Email Ada her quote again
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" onPress={close}>
                    Close
                  </Button>
                )}
              </Actions>
            </>
          )}
        </Dialog>
      )}
    </OfficeFrame>
  );
}

// ---------------------------------------------------------------- the switcher

const LAYOUTS = [
  { key: "A", name: "Approve is the next step" },
  { key: "B", name: "A payment part leads" },
  { key: "C", name: "One Pay, saved card first" },
];

type Case = { name: string; draw: (layout: Layout, go: Go) => ReactNode };

const clean =
  (
    moment: Moment,
    more: { lang?: Lang; plan?: boolean; noCard?: boolean } = {},
  ) =>
  (layout: Layout, go: Go) => (
    <CleanPage
      layout={layout}
      lang={more.lang ?? "en"}
      moment={moment}
      go={go}
      {...more}
    />
  );
const bill = (moment: Moment) => (layout: Layout, go: Go) => (
  <BillPage layout={layout} moment={moment} go={go} />
);

const CASES: Record<string, Case> = {
  "1": { name: "Client clean: before pressing", draw: clean("before") },
  "2": { name: "Client clean: bank's check open", draw: clean("check") },
  "3": { name: "Client clean: bank refused", draw: clean("refused") },
  "4": { name: "Client clean: approved", draw: clean("approved") },
  "5": {
    name: "Client clean: Spanish, plan paused",
    draw: clean("before", { lang: "es", plan: true }),
  },
  "6": {
    name: "Client clean: no saved card left",
    draw: clean("before", { noCard: true }),
  },
  "7": { name: "Client bill (plan On Hold): before", draw: bill("before") },
  "8": { name: "Client bill: bank's check open", draw: bill("check") },
  "9": { name: "Client bill: approved", draw: bill("approved") },
  "10": {
    name: "Client Payments",
    draw: (layout) => <PaymentsPage layout={layout} />,
  },
  "11": {
    name: "Client emails",
    draw: (layout) => <EmailsPage layout={layout} />,
  },
  "12": { name: "Office job", draw: () => <OfficeJobPage /> },
  "13": { name: "Office bill", draw: () => <OfficeBillPage /> },
  "14": {
    name: "Office quote: phone acceptance refused",
    draw: (layout) => <OfficeQuotePage layout={layout} />,
  },
};

export function ApprovePaymentPrototype() {
  const search = useSearch({ strict: false }) as {
    layout?: string;
    case?: string;
    shot?: string;
  };
  const navigate = useNavigate();
  const layout = (
    LAYOUTS.some((l) => l.key === search.layout) ? search.layout! : "A"
  ) as Layout;
  const caseKey = search.case && CASES[search.case] ? search.case : "1";
  const go: Go = (change) =>
    void navigate({
      to: "/prototype/approve-payment",
      search: {
        layout,
        case: caseKey,
        ...(search.shot ? { shot: search.shot } : {}),
        ...change,
      },
    } as never);
  return (
    <>
      <div key={`${layout}-${caseKey}`} className="contents">
        {CASES[caseKey]!.draw(layout, go)}
      </div>
      {!search.shot && (
        <>
          <PrototypeSwitcher
            variants={LAYOUTS}
            current={layout}
            keys={["ArrowUp", "ArrowDown"]}
            className="bottom-36 md:bottom-16"
            onChange={(key) => go({ layout: key })}
          />
          <PrototypeSwitcher
            variants={Object.entries(CASES).map(([key, c]) => ({
              key,
              name: c.name,
            }))}
            current={caseKey}
            onChange={(key) => go({ case: key })}
          />
        </>
      )}
    </>
  );
}
