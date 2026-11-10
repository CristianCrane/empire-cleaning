import type { ServicePageWords } from "./index.ts";

// the page in Spanish (disinfecting.ts has the English):
// a draft the owner checks (#206)
export const disinfecting: ServicePageWords = {
  slug: "desinfeccion",
  title: "Desinfección en Queens, NYC y Long Island",
  description:
    "Desinfección de superficies de mucho contacto y espacios compartidos en casas y negocios de Queens, Brooklyn, Manhattan y Long Island. Pida una cotización.",
  heading: "Desinfección de casas y lugares de trabajo",
  intro:
    "Las manijas, los interruptores y las encimeras que todos tocan, desinfectados además de limpios: en casa después de que alguien estuvo enfermo, o en un lugar de trabajo compartido durante todo el año.",
  included: {
    title: "Qué desinfectamos",
    rooms: [
      {
        name: "Superficies de mucho contacto",
        items: [
          "Manijas, perillas y placas de empuje de las puertas",
          "Interruptores y barandales",
          "Grifos y palancas de los inodoros",
          "Controles remotos, teléfonos y teclados, si lo desea",
        ],
      },
      {
        name: "Cocinas y baños",
        items: [
          "Encimeras, mesas y fregaderos",
          "Manijas de los electrodomésticos",
          "Inodoros, lavabos, bañeras y duchas",
        ],
      },
      {
        name: "Espacios compartidos",
        items: [
          "Mostradores de recepción y salas de espera",
          "Salas de descanso y de reuniones",
          "Brazos de sillas y superficies de mesas",
        ],
      },
    ],
    note: "Limpiamos una superficie antes de desinfectarla: un desinfectante solo funciona bien sobre una superficie limpia.",
  },
  pricing: {
    title: "Cómo se calcula el precio",
    text: [
      "La desinfección es parte de una limpieza. En su solicitud de cotización, elija la limpieza que necesita (una limpieza estándar o profunda, Standard o Deep Clean, para una casa; la limpieza comercial, Commercial cleaning, para un negocio) y díganos en la nota que quiere desinfección, y de qué. Si la quiere en cada visita, dígalo y la incluimos en cada una.",
      "Su cotización dice lo que cubre y cuánto tiempo estaremos. Acéptela en línea y pague un depósito para reservar; el resto se cobra cuando la limpieza está terminada.",
    ],
  },
  when: {
    title: "Cuándo reservarla",
    text: [
      "En casa: después de que alguien en la casa estuvo enfermo, antes de que llegue un bebé o un familiar mayor, o durante la temporada de resfriados y gripe. También antes de una fiesta o de los días festivos, cuando entra más gente de lo normal.",
      "En el trabajo: en cualquier lugar donde mucha gente comparte las mismas superficies, como oficinas, consultorios, tiendas y estudios, como parte de su limpieza regular o una sola vez.",
    ],
  },
  faqs: [
    {
      question: "¿Qué servicio elijo en el formulario?",
      answer:
        "La limpieza que necesite: estándar o profunda (Standard o Deep Clean) para una casa, la limpieza comercial (Commercial cleaning) para un negocio. Luego diga en la nota que quiere desinfección, y cualquier cosa en particular.",
    },
    {
      question: "¿Es una visita aparte?",
      answer:
        "No hace falta. La desinfección se hace como parte de una limpieza, así que limpiamos cada superficie primero y luego la desinfectamos.",
    },
    {
      question: "Tengo niños y mascotas. ¿Es un problema?",
      answer:
        "Para nada. Cuéntenos de ellos cuando pida una cotización, para que podamos planear la visita con ellos en cuenta.",
    },
    {
      question: "¿Pueden desinfectar nuestra oficina con regularidad?",
      answer:
        "Sí. Pídala como parte de la limpieza regular de su oficina, los días que elija.",
    },
    {
      question: "¿Pueden desinfectar después de que alguien estuvo enfermo?",
      answer:
        "Sí. Díganoslo en la nota, y qué cuartos usó más esa persona, para empezar por ahí.",
    },
    {
      question: "¿Cuánto tarda?",
      answer:
        "Depende de cuánto haya que desinfectar. Su cotización dice cuánto tiempo estaremos.",
    },
    {
      question: "¿Tengo que estar en casa?",
      answer: "No. Díganos cómo entramos y cerramos con llave al terminar.",
    },
    {
      question: "¿Desinfectan gimnasios y estudios?",
      answer:
        "Sí, como negocios: elija la limpieza comercial (Commercial cleaning) y cuéntenos del equipo en la nota.",
    },
    {
      question: "¿Pueden desinfectar una casa antes de que nos mudemos?",
      answer:
        "Sí. Elija la limpieza de mudanza (Move-in/out Clean) cuando pida una cotización, y diga en la nota que también la quiere desinfectada.",
    },
  ],
};
