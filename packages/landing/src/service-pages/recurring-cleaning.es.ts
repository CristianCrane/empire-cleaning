import type { ServicePageWords } from "./index.ts";

// the page in Spanish (recurring-cleaning.ts has the English):
// a draft the owner checks (#206)
export const recurringCleaning: ServicePageWords = {
  slug: "limpieza-regular",
  title: "Limpieza regular en Queens, NYC y Long Island",
  description:
    "Limpieza de casas cada semana, cada dos semanas o cada cuatro semanas en Queens, Brooklyn, Manhattan y Long Island, con 10% de descuento en cada visita. Pida una cotización.",
  heading: "Limpieza semanal, quincenal o mensual",
  intro:
    "Un plan de limpieza mantiene su casa limpia sin que tenga que pensar en ello: el mismo día, a la misma hora, cada semana, cada dos o cada cuatro. Y cada visita tiene un 10% de descuento.",
  included: {
    title: "Qué incluye cada visita",
    rooms: [
      {
        name: "Cocina",
        items: [
          "Encimeras, fregadero y salpicadero limpios",
          "Estufa limpiada",
          "Exterior de los electrodomésticos y frentes de los gabinetes limpiados",
          "Piso aspirado y trapeado",
        ],
      },
      {
        name: "Baños",
        items: [
          "Ducha, bañera y azulejos limpios",
          "Inodoro limpio por dentro y por fuera",
          "Lavabos, grifos y espejos brillantes",
          "Piso trapeado",
        ],
      },
      {
        name: "Cada cuarto",
        items: [
          "Superficies y muebles sin polvo",
          "Interruptores y manijas de puertas limpiados",
          "Pisos aspirados y trapeados",
          "Basura vaciada",
        ],
      },
    ],
    note: "Cada visita es una limpieza estándar. ¿Quiere una limpieza profunda de vez en cuando, o un extra como el interior del refrigerador? Pídalo como una cotización aparte cuando quiera; su plan sigue igual.",
  },
  pricing: {
    title: "Cómo se calcula el precio de un plan de limpieza",
    text: [
      "Cada visita se calcula a partir de su casa, como cualquier cotización: los cuartos, los pisos, las mascotas y cuánta limpieza necesita. Luego se descuenta un 10% de cada visita mientras dure el plan.",
      "Un plan tiene un solo depósito durante toda su vida, no uno por visita. Cada visita se cobra cuando está terminada, y cuando el plan termina, el depósito se aplica a la última.",
    ],
  },
  when: {
    title: "Cómo empieza",
    text: [
      "Todo plan empieza con una primera limpieza, reservada aparte. Así usted ve cómo trabajamos, y nosotros comprobamos que su casa es como la describió antes de comprometernos con visitas regulares. Le recomendamos una limpieza profunda para ella.",
      "Después, le enviamos una cotización para el plan: el día o los días que quiera, cada semana, cada dos semanas o cada cuatro semanas. Acéptela y las visitas quedan reservadas. Sáltese una cuando esté de viaje, o termine el plan cuando lo necesite.",
    ],
  },
  faqs: [
    {
      question: "¿Por qué necesito una primera limpieza antes del plan?",
      answer:
        "Para que vea cómo trabajamos antes de comprometerse, y nosotros veamos que su casa es como la describió. Lo mejor es una limpieza profunda, porque pone todo al nivel que luego mantiene cada visita.",
    },
    {
      question: "¿Puedo saltarme una visita?",
      answer:
        "Sí. Cancele esa visita con tiempo y el plan sigue como siempre. Una cancelación de último momento tiene un cargo, como cualquier limpieza.",
    },
    {
      question: "¿Puedo tener más de una visita por semana?",
      answer:
        "Sí. Un plan puede venir varios días cada semana, cada uno a su propia hora.",
    },
    {
      question: "¿Puedo terminar el plan?",
      answer:
        "Cuando lo necesite. El depósito del plan se aplica a su última visita.",
    },
    {
      question: "¿Puedo cambiar el día?",
      answer:
        "Sí. Pida una nueva cotización del plan con el día que quiera; cuando la acepte, el plan sigue desde entonces en el nuevo día.",
    },
    {
      question: "¿Y si necesito una limpieza extra antes de una fiesta?",
      answer:
        "Pida una cotización aparte cuando quiera, para una limpieza profunda o una estándar. Tener un plan nunca le impide reservar una visita extra.",
    },
    {
      question: "¿Puedo añadir extras a una visita?",
      answer:
        "Sí. Pida una cotización aparte para el extra, o una nueva cotización del plan si quiere que se haga en cada visita a partir de entonces.",
    },
  ],
};
