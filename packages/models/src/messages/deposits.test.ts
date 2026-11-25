import { describe, expect, test } from "vitest";
import type { DepositPaying, QuoteOption } from "../index.ts";
import { formats } from "../format.ts";
import { depositAlertOf, deposits } from "./deposits.ts";

// a one-off Quote with two Services, as its page holds it
const STANDARD = "standard";
const DEEP = "deep";
const options = [
  { serviceKey: STANDARD, serviceName: "Standard Clean" },
  { serviceKey: DEEP, serviceName: "Deep Clean" },
] as QuoteOption[];
const refunded = (
  why: Extract<DepositPaying, { status: "refunded" }>["why"],
  depositCents = 4872,
): DepositPaying => ({
  status: "refunded",
  why,
  at: "2026-11-25T19:20:00Z",
  serviceKey: STANDARD,
  depositCents,
});
const quote = (
  paying: DepositPaying | null,
  status: "sent" | "expired" | "turned_down" | "declined" = "sent",
  bookable: string[] = [],
) => ({
  kind: "one_off" as const,
  status,
  bookable,
  paying,
  options,
  changesPlan: null,
});

describe("where a Deposit payment stands, as the Client's Quote page says it", () => {
  test("none when there's none", () => {
    expect(depositAlertOf("en", quote(null))).toBeNull();
  });

  test("going through says when they'll hear; their bank asking, by when, for which Service", () => {
    expect(
      depositAlertOf(
        "en",
        quote({
          status: "goingThrough",
          serviceKey: STANDARD,
          depositCents: 0,
        }),
      ),
    ).toEqual({
      tone: "info",
      text: "We'll email you as soon as your clean is booked, usually within half an hour.",
    });
    const until = "2026-11-25T19:29:00Z";
    // 2:29 PM, as the business's clock writes it
    const twoTwentyNine = formats.en.formatTime(until);
    const approving = {
      status: "approving",
      until,
      serviceKey: STANDARD,
    } as const;
    expect(
      depositAlertOf("en", quote({ ...approving, depositCents: 4872 })),
    ).toEqual({
      tone: "warning",
      text: `Your bank hasn't approved your payment yet. Approve it in your bank's app by ${twoTwentyNine} to book your Standard Clean, or press Accept and pay to start over: you're only charged once.`,
    });
    // a plan's names no Service, as each weekday's is the plan's
    expect(
      depositAlertOf("en", {
        ...quote({ ...approving, depositCents: 0 }),
        kind: "service_plan",
      })?.text,
    ).toBe(
      `Your bank hasn't approved your card yet. Approve it in your bank's app by ${twoTwentyNine} to start your plan, or press Accept and book to start over. Nothing is charged.`,
    );
  });

  test("going through on a quote that expired meanwhile promises no booking", () => {
    const going = (depositCents: number) =>
      depositAlertOf(
        "en",
        quote(
          { status: "goingThrough", serviceKey: STANDARD, depositCents },
          "expired",
        ),
      );
    expect(going(4872)).toEqual({
      tone: "info",
      text: "This quote expired while your payment was still going through with your bank, so nothing will be booked. If your bank takes the payment, we'll refund it.",
    });
    expect(going(0)?.text).toBe(
      "This quote expired while your bank was still approving your card, so nothing will be booked.",
    );
  });
});

describe("how a Deposit payment that didn't book ended, as the Client is told", () => {
  test("never approved, or refused, says so and asks them to try again", () => {
    expect(
      depositAlertOf(
        "en",
        quote({
          status: "notApproved",
          at: "2026-11-25T19:29:00Z",
          serviceKey: STANDARD,
          depositCents: 4872,
        }),
      ),
    ).toEqual({
      tone: "info",
      text: "Your payment wasn't approved, so nothing was taken. Please try again, or use another card.",
    });
    expect(
      depositAlertOf(
        "es",
        quote({
          status: "failed",
          at: "2026-11-25T19:29:00Z",
          why: "la tarjeta venció",
          serviceKey: STANDARD,
          depositCents: 4872,
        }),
      ),
    ).toEqual({
      tone: "danger",
      text: "Su pago no pasó (la tarjeta venció). Vuelva a intentarlo, o use otra tarjeta.",
    });
  });

  test("its time filled: a new quote to come when nothing's bookable, the other Service when it is", () => {
    expect(depositAlertOf("en", quote(refunded("no_room")))?.text).toBe(
      "Sorry, that time got booked up while your bank was approving the payment. We've refunded your deposit. We'll send you a new quote for another time.",
    );
    expect(
      depositAlertOf("en", quote(refunded("no_room"), "sent", [DEEP]))?.text,
    ).toBe(
      "Sorry, that time got booked up for the Standard Clean while your bank was approving the payment, so we've refunded your deposit. The Deep Clean can still be booked then.",
    );
  });

  test("a closed quote says how it closed", () => {
    expect(
      depositAlertOf("en", quote(refunded("closed"), "expired"))?.text,
    ).toBe(
      "This quote expired while your bank was approving the payment, so we've refunded your deposit.",
    );
    expect(
      depositAlertOf("en", quote(refunded("closed"), "turned_down"))?.text,
    ).toBe(
      "We couldn't take this one on, so we've refunded the deposit you paid while your bank was approving it.",
    );
    expect(
      depositAlertOf("en", quote(refunded("closed"), "declined"))?.text,
    ).toBe(
      "This quote closed while your bank was approving the payment, so we've refunded your deposit.",
    );
  });

  test("a card saved with nothing charged (a 0% Deposit) leads with nothing booked, not a refund", () => {
    expect(depositAlertOf("en", quote(refunded("no_room", 0)))?.text).toBe(
      "Sorry, that time got booked up while your bank was approving your card, so nothing was booked. We'll send you a new quote for another time.",
    );
    expect(depositAlertOf("en", quote(refunded("revised", 0)))?.text).toBe(
      "This quote was updated while your bank was approving your card, so nothing was booked. Please take a look at what's changed.",
    );
    expect(
      depositAlertOf("es", quote(refunded("closed", 0), "expired"))?.text,
    ).toBe(
      "Esta cotización venció mientras su banco aprobaba su tarjeta, así que no se reservó nada.",
    );
    expect(
      depositAlertOf("en", quote(refunded("closed", 0), "turned_down"))?.text,
    ).toBe("We couldn't take this one on, so nothing was booked.");
  });

  test("a card save never approved, or declined, says nothing was booked", () => {
    const at = "2026-11-25T19:29:00Z";
    expect(
      depositAlertOf(
        "en",
        quote({
          status: "notApproved",
          at,
          serviceKey: STANDARD,
          depositCents: 0,
        }),
      ),
    ).toEqual({
      tone: "info",
      text: "Your card wasn't approved, so nothing was booked. Please try again, or use another card.",
    });
    expect(
      depositAlertOf(
        "en",
        quote({
          status: "failed",
          at,
          why: null,
          serviceKey: STANDARD,
          depositCents: 0,
        }),
      ),
    ).toEqual({
      tone: "danger",
      text: "Your card was declined, so nothing was booked. Please try again, or use another card.",
    });
    expect(
      depositAlertOf(
        "es",
        quote({
          status: "failed",
          at,
          why: "la tarjeta venció",
          serviceKey: STANDARD,
          depositCents: 0,
        }),
      )?.text,
    ).toBe(
      "Su tarjeta fue rechazada (la tarjeta venció), así que no se reservó nada. Vuelva a intentarlo, o use otra tarjeta.",
    );
  });
});

describe("pressed again while their bank finishes the first", () => {
  test("a payment says nothing more was charged; a card, that nothing is booked twice", () => {
    expect(deposits.en.depositProcessing("clean", false)).toBe(
      "Your first payment is still going through with your bank, so nothing more was charged. We'll email you as soon as your clean is booked, usually within half an hour.",
    );
    expect(deposits.es.depositProcessing("plan", true)).toBe(
      "Su banco aún está terminando de aprobar su tarjeta, así que nada se reserva dos veces. Le enviaremos un correo en cuanto su plan quede reservado, normalmente en menos de media hora.",
    );
  });
});

describe("their bank asking them to approve it", () => {
  test("a payment names its Service and when it's called off", () => {
    expect(
      deposits.en.depositWaiting({
        goal: "clean",
        service: "Standard Clean",
        until: "2:29 PM",
      }),
    ).toBe(
      "Your bank hasn't approved your payment yet. Approve it in your bank's app by 2:29 PM to book your Standard Clean, or press Accept and pay to start over: you're only charged once.",
    );
    expect(
      deposits.es.depositWaiting({
        goal: "plan",
        service: null,
        until: "1:05 p.m.",
      }),
    ).toBe(
      "Su banco aún no ha aprobado su pago. Apruébelo en la app de su banco antes de la 1:05 p.m. para empezar su plan, o presione Aceptar y pagar para empezar de nuevo: solo se le cobra una vez.",
    );
  });

  test("a card saved with nothing charged says when it's called off, and how to start over", () => {
    expect(
      deposits.en.cardWaiting({
        goal: "clean",
        service: "Standard Clean",
        until: "2:29 PM",
      }),
    ).toBe(
      "Your bank hasn't approved your card yet. Approve it in your bank's app by 2:29 PM to book your Standard Clean, or press Accept and book to start over. Nothing is charged.",
    );
    expect(
      deposits.es.cardWaiting({
        goal: "change",
        service: null,
        until: "2:29 p. m.",
      }),
    ).toBe(
      "Su banco aún no ha aprobado su tarjeta. Apruébela en la app de su banco antes de las 2:29 p. m. para cambiar su plan, o presione Aceptar las nuevas condiciones para empezar de nuevo. No se cobra nada.",
    );
  });
});
