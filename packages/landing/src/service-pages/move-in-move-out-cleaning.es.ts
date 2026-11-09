import type { ServicePageWords } from "./index.ts";
import { addOnsNote } from "./shared.ts";

// the page in Spanish (move-in-move-out-cleaning.ts has the English):
// a draft the owner checks (#206)
export const moveInMoveOut: ServicePageWords = {
  slug: "limpieza-de-mudanza",
  title: "Limpieza de mudanza en Queens, NYC y Long Island",
  description:
    "Limpieza al mudarse o al entrar en Queens, Brooklyn, Manhattan y Long Island: una casa vacía limpia para la inspección o para su primera noche. Pida una cotización.",
  heading: "Limpieza de mudanza, al salir o al entrar",
  intro:
    "Una casa vacía, limpia de los clósets a los pisos: lista para la inspección del dueño, los nuevos propietarios o su propia primera noche.",
  included: {
    title: "Qué incluye una limpieza de mudanza",
    rooms: [
      {
        name: "Cocina",
        items: [
          "Encimeras, salpicadero y fregadero restregados",
          "Estufa y campana desengrasadas",
          "Exterior de cada electrodoméstico y gabinete limpiado",
          "Detrás y debajo de los electrodomésticos que podemos mover sin riesgo",
          "Piso lavado de borde a borde",
        ],
      },
      {
        name: "Baños",
        items: [
          "Ducha, bañera, azulejos y juntas restregados",
          "Inodoro limpio por dentro, por fuera y por detrás",
          "Lavabos, grifos, espejos y botiquín limpios",
          "Piso lavado de borde a borde",
        ],
      },
      {
        name: "Cada cuarto",
        items: [
          "Clósets y repisas limpios por dentro",
          "Zócalos, puertas y marcos de puertas limpiados",
          "Marcos y rieles de las ventanas",
          "Lámparas, interruptores y enchufes limpiados",
          "Pisos aspirados y trapeados",
        ],
      },
    ],
    note: addOnsNote.es,
  },
  pricing: {
    title: "Cómo se calcula el precio",
    text: [
      "Su cotización se calcula a partir de la casa: los dormitorios y baños, cuántos pisos, los adicionales que elija y cuánta limpieza necesita. Una casa después de un alquiler largo suele necesitar más que una que se mantuvo al día.",
      "Tiene el precio de una limpieza profunda, porque lo es, con la casa vacía. Su cotización dice cuánto tiempo estaremos; acéptela en línea y pague un depósito para reservar, y el resto se cobra cuando la limpieza está terminada.",
    ],
  },
  when: {
    title: "Cuándo reservarla",
    text: [
      "Al mudarse: cuando sus cosas ya salieron y antes de entregar las llaves. Muchos contratos piden devolver la casa barrida o mejor, y una casa vacía y limpia facilita la inspección final.",
      "Al entrar: antes de que lleguen sus muebles, para que cada gabinete, clóset y rincón esté limpio antes de guardar nada. Los dueños y agentes también nos contratan entre inquilinos: pida una cotización para cada unidad.",
    ],
  },
  faqs: [
    {
      question: "¿La casa tiene que estar vacía?",
      answer:
        "Sí, o lo más vacía posible. Limpiamos dentro de los clósets, a lo largo de los zócalos y en cada rincón, y los muebles y las cajas estorban.",
    },
    {
      question: "¿Me ayudará a recuperar mi depósito de alquiler?",
      answer:
        "No podemos prometer lo que decida el dueño, pero limpiamos lo que revisan: la cocina, los baños, los pisos, dentro de los clósets. Cuéntenos lo que dice su contrato cuando pida una cotización.",
    },
    {
      question: "¿Pueden limpiar el día que me mudo?",
      answer:
        "Normalmente sí. El fin de mes se llena primero, así que pida una cotización en cuanto sepa su fecha.",
    },
    {
      question: "¿Está incluido el interior del refrigerador y del horno?",
      answer:
        "Son adicionales, junto con el interior de los gabinetes y las ventanas por dentro. Márquelos cuando pida una cotización, como hace la mayoría de la gente que se muda.",
    },
    {
      question: "Soy dueño de un alquiler. ¿Pueden limpiar entre inquilinos?",
      answer:
        "Sí. Pida una cotización para cada unidad, y díganos cómo entramos.",
    },
    {
      question: "¿Cuánto tarda?",
      answer:
        "Depende del tamaño de la casa y de cuánta limpieza necesite. Su cotización dice cuánto tiempo estaremos, para que pueda organizar la mudanza.",
    },
  ],
};
