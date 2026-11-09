import type { ServicePageWords } from "./index.ts";
import { addOnsNote } from "./shared.ts";

// the page in Spanish (standard-cleaning.ts has the English):
// a draft the owner checks (#206)
export const standardCleaning: ServicePageWords = {
  slug: "limpieza-estandar",
  title: "Limpieza estándar de casas en Queens y Long Island",
  description:
    "Limpieza estándar de casas en Queens, Brooklyn, Manhattan y Long Island: cocina, baños, polvo y pisos, bien hechos. Pida una cotización.",
  heading: "Limpieza estándar de casas",
  intro:
    "La limpieza que hace que una casa limpia se siga sintiendo así: la cocina, los baños, el polvo y los pisos, bien hechos cada vez.",
  included: {
    title: "Qué incluye una limpieza estándar",
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
        name: "Dormitorios y áreas comunes",
        items: [
          "Superficies y muebles sin polvo",
          "Espejos y mesas de vidrio brillantes",
          "Pisos aspirados y trapeados",
        ],
      },
      {
        name: "En toda la casa",
        items: [
          "Interruptores y manijas de puertas limpiados",
          "Basura vaciada",
        ],
      },
    ],
    note: `Los zócalos, las rejillas, las juntas y detrás de los electrodomésticos son parte de una limpieza profunda. ${addOnsNote.es}`,
  },
  pricing: {
    title: "Cómo se calcula el precio de una limpieza estándar",
    text: [
      "No publicamos un precio, porque no hay dos casas iguales. Su cotización se calcula a partir de su casa: los dormitorios y baños, cuántos pisos, si hay mascotas, los extras que elija y cuánta limpieza necesita (ligera, moderada o intensa).",
      "Su cotización dice cuánto tiempo estaremos. La acepta en línea y paga un depósito para reservar; el resto se cobra cuando la limpieza está terminada.",
    ],
  },
  when: {
    title: "Para quién es",
    text: [
      "Casas que ya están en buen estado y hay que mantenerlas así: entre limpiezas profundas, antes del fin de semana, o cada una o dos semanas como parte de un plan de limpieza, donde cada visita tiene un 10% de descuento.",
      "Para una primera visita recomendamos una limpieza profunda, para que todo empiece al mismo nivel. Si su casa se limpió bien hace poco, puede empezar con una limpieza estándar.",
    ],
  },
  faqs: [
    {
      question: "¿Puedo empezar con una limpieza estándar?",
      answer:
        "Sí. Su cotización también le ofrecerá una limpieza profunda para su primera visita, ya que la recomendamos, pero usted elige cuál reservar.",
    },
    {
      question: "¿Cómo tengo una limpieza estándar cada una o dos semanas?",
      answer:
        "Con un plan de limpieza: después de su primera limpieza, elija cada semana, cada dos semanas o cada cuatro semanas, y cada visita tiene un 10% de descuento.",
    },
    {
      question: "¿Cuánto tarda una limpieza estándar?",
      answer:
        "Depende del tamaño de su casa y de cuánta limpieza necesite. Su cotización dice cuánto tiempo estaremos.",
    },
    {
      question: "¿Tengo que estar en casa?",
      answer: "No. Díganos cómo entramos y cerramos con llave al terminar.",
    },
    {
      question: "¿Pueden enfocarse en ciertos cuartos?",
      answer:
        "Sí. Díganos en la nota qué cuartos le importan más, y los que prefiere que no toquemos, y el equipo dedicará su tiempo donde usted quiera.",
    },
    {
      question: "¿Está bien si tengo mascotas?",
      answer:
        "Claro que sí. Díganoslo cuando pida una cotización, para que esté en el tiempo que calculamos y el equipo sepa a quién va a encontrar.",
    },
    {
      question: "¿Puedo añadir extras, como el interior del refrigerador?",
      answer:
        "Sí. El interior del refrigerador, el interior del horno, el interior de los gabinetes y las ventanas por dentro son extras: marque los que quiera cuando pida una cotización y se incluyen en el precio.",
    },
  ],
};
